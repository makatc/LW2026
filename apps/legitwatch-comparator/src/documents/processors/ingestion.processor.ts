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
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<IngestionJobResult> {
    const startTime = Date.now();
    const { snapshotId, versionTag } = job.data;

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

      // Step 4: Detect structure
      const detectedChunks = this.structureDetector.detectStructure(normalizedText);

      if (detectedChunks.length === 0) {
        throw new Error('No structural elements detected in document');
      }

      const validation = this.structureDetector.validateStructure(detectedChunks);
      if (!validation.isValid) {
        this.logger.warn(`Structure validation issues: ${validation.issues.join(', ')}`);
      }

      this.logger.debug(`Detected ${detectedChunks.length} structural chunks`);

      // Step 5: Create or get Document
      const document = await this.getOrCreateDocument(snapshot);

      // Step 6: Create DocumentVersion
      const version = await this.createDocumentVersion(
        document.id,
        snapshot,
        versionTag || snapshot.metadata?.versionTag || 'v1',
        normalizedText,
      );

      // Step 7: Create DocumentChunks
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

      // Try to mark version as ERROR if it was created
      try {
        const versions = await this.versionRepository.find({
          where: { status: DocumentVersionStatus.PROCESSING },
          order: { createdAt: 'DESC' },
          take: 1,
        });

        if (versions.length > 0) {
          versions[0].status = DocumentVersionStatus.ERROR;
          await this.versionRepository.save(versions[0]);
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
