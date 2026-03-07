import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import {
  SourceSnapshot,
  Document,
  DocumentVersion,
  DocumentChunk,
  DocumentVersionStatus,
} from '../../entities';
import { StructureDetectorService, NormalizerService } from '../services';
import { DoclingService } from '../services/docling.service';
import type { IngestionJobData, IngestionJobResult } from '../dto';

/**
 * IngestionProcessor
 * BullMQ processor that handles document ingestion jobs
 * Takes a SourceSnapshot, processes it, and creates structured DocumentChunks
 */
@Processor('ingestion-queue', {
  concurrency: 2, // Process 2 jobs concurrently
})
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    @InjectRepository(SourceSnapshot)
    private readonly snapshotRepository: Repository<SourceSnapshot>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepository: Repository<DocumentChunk>,
    private readonly normalizer: NormalizerService,
    private readonly structureDetector: StructureDetectorService,
    private readonly doclingService: DoclingService,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<IngestionJobResult> {
    const startTime = Date.now();
    const { snapshotId, versionTag, fileBufferBase64, originalFileName } = job.data;

    this.logger.log(`Processing ingestion job ${job.id} for snapshot ${snapshotId}`);

    try {
      // Step 1: Fetch the SourceSnapshot
      const snapshot = await this.snapshotRepository.findOne({
        where: { id: snapshotId },
      });

      if (!snapshot) {
        throw new Error(`SourceSnapshot ${snapshotId} not found`);
      }

      // Step 2: Validate raw content
      if (!snapshot.rawContent || snapshot.rawContent.trim().length === 0) {
        throw new Error('SourceSnapshot has empty content');
      }

      this.logger.debug(`Processing snapshot with ${snapshot.rawContent.length} characters`);

      // Step 3: Normalize the text
      const { normalizedText, stats } = this.normalizer.normalize(snapshot.rawContent);

      if (!this.normalizer.validateNormalization(snapshot.rawContent, normalizedText)) {
        this.logger.warn('Normalization validation failed, proceeding with caution');
      }

      this.logger.debug(`Normalized: ${stats.removedCharacters} chars removed`);

      // Step 4: Detect structure — try Docling first, fall back to regex detector
      let detectedChunks: Array<{
        type: any;
        label: string;
        content: string;
        orderIndex: number;
        startPosition: number;
        endPosition: number;
      }> = [];

      // Try Docling with original file bytes (passed through job data)
      // Falls back to normalized text as .txt if bytes not available
      const doclingBuffer = fileBufferBase64
        ? Buffer.from(fileBufferBase64, 'base64')
        : Buffer.from(normalizedText, 'utf-8');
      const doclingFileName = fileBufferBase64
        ? (originalFileName ?? snapshot.originalFileName ?? 'document.pdf')
        : (snapshot.originalFileName ?? 'document').replace(/\.(pdf|docx?)$/i, '.txt');

      if (doclingBuffer.length > 0) {
        const doclingResult = await this.doclingService.parse(doclingBuffer, doclingFileName);

        if (doclingResult && doclingResult.chunks.length >= 2) {
          this.logger.log(
            `Docling extracted ${doclingResult.chunks.length} chunks from "${doclingFileName}"`,
          );
          detectedChunks = doclingResult.chunks.map((c, i) => ({
            type: this.mapDoclingType(c.type),
            label: c.label,
            content: c.content,
            orderIndex: i,
            startPosition: 0,
            endPosition: c.content.length,
          }));
        }
      }

      // Fallback: regex-based structure detector
      if (detectedChunks.length < 2) {
        if (detectedChunks.length > 0) {
          this.logger.debug('Docling result insufficient — falling back to regex detector');
        }
        detectedChunks = this.structureDetector.detectStructure(normalizedText);
      }

      if (detectedChunks.length === 0) {
        this.logger.warn('No structural elements detected — treating entire document as one chunk');
        detectedChunks.push({
          type: 'section' as any,
          label: 'Documento completo',
          content: normalizedText,
          orderIndex: 0,
          startPosition: 0,
          endPosition: normalizedText.length,
        });
      }

      const validation = this.structureDetector.validateStructure(detectedChunks);
      if (!validation.isValid) {
        this.logger.warn(`Structure validation issues: ${validation.issues.join(', ')}`);
      }

      this.logger.debug(`Detected ${detectedChunks.length} structural chunks`);

      // Step 5: Re-use the version created during upload (identified by snapshotId in metadata),
      // or create a new document + version for manual/programmatic ingestion.
      let document: Document;
      let version: DocumentVersion;

      const existingVersion = await this.versionRepository
        .createQueryBuilder('v')
        .where("v.metadata->>'snapshotId' = :snapshotId", { snapshotId })
        .getOne();

      if (existingVersion) {
        this.logger.debug(`Re-using existing version ${existingVersion.id} for snapshot ${snapshotId}`);
        const existingDocument = await this.documentRepository.findOne({
          where: { id: existingVersion.documentId },
        });
        if (!existingDocument) throw new Error(`Document for version ${existingVersion.id} not found`);
        document = existingDocument;
        version = existingVersion;
        // Remove any stale chunks from a previous failed ingest
        await this.chunkRepository.delete({ versionId: version.id });
      } else {
        // Manual ingest path: create new document and version
        document = await this.getOrCreateDocument(snapshot);
        version = await this.createDocumentVersion(
          document.id,
          snapshot,
          versionTag || snapshot.metadata?.versionTag || 'v1',
          normalizedText,
        );
      }

      // Step 6: Create DocumentChunks
      const chunks = await this.createDocumentChunks(version.id, detectedChunks);

      // Step 8: Update version status to READY
      version.status = DocumentVersionStatus.READY;
      await this.versionRepository.save(version);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Ingestion completed: ${chunks.length} chunks created in ${processingTime}ms`,
      );

      return {
        documentId: document.id,
        versionId: version.id,
        chunksCreated: chunks.length,
        processingTimeMs: processingTime,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Ingestion failed for snapshot ${snapshotId}: ${error}`);

      // Mark the version that belongs to THIS snapshot as ERROR.
      // Query by snapshotId stored in version metadata to avoid marking a
      // concurrent, unrelated PROCESSING version as failed (Bug 4 fix).
      try {
        const failedVersion = await this.versionRepository
          .createQueryBuilder('v')
          .where("v.metadata->>'snapshotId' = :snapshotId", { snapshotId })
          .getOne();

        if (failedVersion && failedVersion.status === DocumentVersionStatus.PROCESSING) {
          failedVersion.status = DocumentVersionStatus.ERROR;
          await this.versionRepository.save(failedVersion);
          this.logger.log(`Marked version ${failedVersion.id} as ERROR`);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update version status: ${updateError}`);
      }

      return {
        documentId: '',
        versionId: '',
        chunksCreated: 0,
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get existing document or create new one based on snapshot metadata
   */
  private async getOrCreateDocument(snapshot: SourceSnapshot): Promise<Document> {
    // Try to find existing document by metadata
    const itemId = snapshot.metadata?.itemId;

    if (itemId) {
      const existingDoc = await this.documentRepository.findOne({
        where: {
          metadata: {
            itemId,
          } as any,
        },
      });

      if (existingDoc) {
        return existingDoc;
      }
    }

    // Create new document
    const title = snapshot.metadata?.title || `Document from ${snapshot.sourceType}`;
    const description = snapshot.metadata?.description;

    const document = this.documentRepository.create({
      title,
      description,
      documentType: snapshot.sourceType,
      metadata: snapshot.metadata || {},
    });

    return this.documentRepository.save(document);
  }

  /**
   * Create a new DocumentVersion
   */
  private async createDocumentVersion(
    documentId: string,
    snapshot: SourceSnapshot,
    versionTag: string,
    normalizedText: string,
  ): Promise<DocumentVersion> {
    const version = this.versionRepository.create({
      documentId,
      versionTag,
      status: DocumentVersionStatus.PROCESSING,
      normalizedText,
      metadata: {
        snapshotId: snapshot.id,
        sourceUrl: snapshot.sourceUrl,
        originalFileName: snapshot.originalFileName,
        ...snapshot.metadata,
      },
    });

    return this.versionRepository.save(version);
  }

  /** Map Docling chunk type strings to DocumentChunkType enum values */
  private mapDoclingType(doclingType: string): any {
    switch (doclingType) {
      case 'article': return 'article';
      case 'chapter': return 'chapter';
      case 'section': return 'section';
      default: return 'paragraph';
    }
  }

  /**
   * Create DocumentChunk records from detected chunks
   */
  private async createDocumentChunks(
    versionId: string,
    detectedChunks: Array<{
      type: any;
      label: string;
      content: string;
      orderIndex: number;
    }>,
  ): Promise<DocumentChunk[]> {
    const chunks = detectedChunks.map((detected) =>
      this.chunkRepository.create({
        versionId,
        type: detected.type,
        label: detected.label,
        content: detected.content,
        orderIndex: detected.orderIndex,
        metadata: {},
      }),
    );

    return this.chunkRepository.save(chunks);
  }
}
