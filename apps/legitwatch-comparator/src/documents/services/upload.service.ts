import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Document } from '../../entities/document.entity';
import { DocumentVersion } from '../../entities/document-version.entity';
import {
  SourceSnapshot,
  SourceType,
} from '../../entities/source-snapshot.entity';
import { FileParserService } from './file-parser.service';
import { NormalizerService } from './normalizer.service';
import { IngestionService } from './ingestion.service';
import { DocumentVersionStatus } from '../../entities/document-version.entity';

export interface UploadResult {
  success: boolean;
  documentId: string;
  versionId: string;
  snapshotId: string;
  message: string;
  metadata: {
    fileName: string;
    fileSize: number;
    wordCount: number;
    pageCount?: number;
  };
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(SourceSnapshot)
    private readonly snapshotRepo: Repository<SourceSnapshot>,
    private readonly fileParser: FileParserService,
    private readonly normalizer: NormalizerService,
    private readonly ingestionService: IngestionService,
  ) {}

  /**
   * Upload and process a file
   */
  async uploadFile(
    file: Express.Multer.File,
    options: {
      autoIngest?: boolean;
      title?: string;
      description?: string;
    } = {},
  ): Promise<UploadResult> {
    this.logger.log(`Processing uploaded file: ${file.originalname}`);

    // Validate file
    this.fileParser.validateFileSize(file);
    this.fileParser.validateFileType(file);

    // Parse file to extract text
    const parsed = await this.fileParser.parseFile(file);

    // Normalize text
    const normalizationResult = this.normalizer.normalize(parsed.text);
    const normalizedText = normalizationResult.normalizedText;

    // Calculate SHA256 hash of raw content
    const sha256Hash = crypto
      .createHash('sha256')
      .update(parsed.text)
      .digest('hex');

    // Determine sourceType based on mime type
    let sourceType: SourceType = SourceType.UPLOAD;
    if (file.mimetype === 'application/pdf') {
      sourceType = SourceType.PDF;
    } else if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      sourceType = SourceType.DOCX;
    } else if (file.mimetype === 'text/plain') {
      sourceType = SourceType.TEXT;
    }

    // Check if snapshot with same hash already exists
    const existingSnapshot = await this.snapshotRepo.findOne({
      where: { sha256Hash },
    });

    if (existingSnapshot) {
      this.logger.log(
        `Snapshot with same hash already exists: ${existingSnapshot.id}`,
      );
      // TODO: Return existing document/version instead of creating duplicate
    }

    // Determine title (use provided or filename without extension)
    const title =
      options.title ||
      file.originalname.replace(/\.(docx?|pdf|txt)$/i, '').trim();

    // Create SourceSnapshot (immutable record of upload)
    const snapshot = this.snapshotRepo.create({
      sourceType,
      sha256Hash,
      rawContent: parsed.text,
      originalFileName: file.originalname,
      fileSize: file.size,
      metadata: {
        normalizedText,
        mimeType: file.mimetype,
        wordCount: parsed.metadata.wordCount,
        pageCount: parsed.metadata.pageCount,
        uploadedAt: new Date().toISOString(),
        description: options.description,
      },
    });

    await this.snapshotRepo.save(snapshot);
    this.logger.debug(`Created SourceSnapshot: ${snapshot.id}`);

    // Create Document
    const document = this.documentRepo.create({
      title,
      description: options.description,
      documentType: sourceType,
      metadata: {
        snapshotId: snapshot.id,
        originalFileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
    });

    await this.documentRepo.save(document);
    this.logger.debug(`Created Document: ${document.id}`);

    // Create DocumentVersion
    const version = this.versionRepo.create({
      documentId: document.id,
      versionTag: `v1-${Date.now()}`,
      status: DocumentVersionStatus.PROCESSING,
      normalizedText,
      metadata: {
        snapshotId: snapshot.id,
        wordCount: parsed.metadata.wordCount,
        pageCount: parsed.metadata.pageCount,
        parsedAt: new Date().toISOString(),
        normalizationStats: normalizationResult.stats,
      },
    });

    await this.versionRepo.save(version);
    this.logger.debug(`Created DocumentVersion: ${version.id}`);

    // Auto-ingest if requested (default: true)
    if (options.autoIngest !== false) {
      this.logger.log(`Auto-ingesting snapshot: ${snapshot.id}`);
      await this.ingestionService.queueIngestion(snapshot.id);
    }

    return {
      success: true,
      documentId: document.id,
      versionId: version.id,
      snapshotId: snapshot.id,
      message: `File uploaded successfully: ${file.originalname}`,
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        wordCount: parsed.metadata.wordCount,
        pageCount: parsed.metadata.pageCount,
      },
    };
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: { autoIngest?: boolean } = {},
  ): Promise<UploadResult[]> {
    this.logger.log(`Processing ${files.length} uploaded files`);

    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(file, options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to upload file ${file.originalname}:`, error);
        results.push({
          success: false,
          documentId: '',
          versionId: '',
          snapshotId: '',
          message: `Failed to upload ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: {
            fileName: file.originalname,
            fileSize: file.size,
            wordCount: 0,
          },
        });
      }
    }

    return results;
  }
}
