import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { IngestionService, JobStatusInfo } from './services/ingestion.service';
import { UploadService, UploadResult } from './services/upload.service';
import { FileParserService, ParsedFile } from './services/file-parser.service';
import { IngestDocumentDto } from './dto';

/**
 * DocumentsController
 * Handles HTTP endpoints for document ingestion and processing
 */
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly uploadService: UploadService,
    private readonly fileParserService: FileParserService,
  ) {}

  /**
   * Upload a single file
   * POST /documents/upload
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('title') title?: string,
    @Query('description') description?: string,
    @Query('autoIngest') autoIngest?: string,
  ): Promise<UploadResult> {
    this.logger.log(`File upload request: ${file?.originalname || 'unknown'}`);

    if (!file) {
      throw new BadRequestException(
        'No se recibió ningún archivo. Verifica que el campo del formulario se llame "file".',
      );
    }

    return this.uploadService.uploadFile(file, {
      title,
      description,
      autoIngest: autoIngest !== 'false',
    });
  }

  /**
   * Upload multiple files
   * POST /documents/upload/batch
   */
  @Post('upload/batch')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('autoIngest') autoIngest?: string,
  ): Promise<UploadResult[]> {
    this.logger.log(`Batch upload request: ${files?.length || 0} files`);

    return this.uploadService.uploadFiles(files, {
      autoIngest: autoIngest !== 'false',
    });
  }

  /**
   * Extract text from a file without persisting it
   * POST /documents/extract
   */
  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async extractText(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ParsedFile> {
    this.logger.log(`Text extraction request: ${file?.originalname || 'unknown'}`);
    this.fileParserService.validateFileSize(file);
    this.fileParserService.validateFileType(file);
    return this.fileParserService.parseFile(file);
  }

  /**
   * Queue a document for ingestion
   * POST /documents/ingest
   */
  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestDocument(@Body() body: IngestDocumentDto): Promise<{
    jobId: string;
    message: string;
  }> {
    this.logger.log(`Ingestion request received for snapshot ${body.snapshotId}`);

    try {
      const jobId = await this.ingestionService.queueIngestion(
        body.snapshotId,
        body.versionTag,
      );

      return {
        jobId,
        message: 'Document queued for ingestion',
      };
    } catch (error) {
      this.logger.error(`Failed to queue ingestion: ${error}`);
      throw error;
    }
  }

  /**
   * Get the status of an ingestion job
   * GET /documents/jobs/:jobId
   */
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string): Promise<JobStatusInfo> {
    this.logger.debug(`Job status request for ${jobId}`);

    try {
      return await this.ingestionService.getJobStatus(jobId);
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error}`);
      throw error;
    }
  }

  /**
   * Get the processing status of a specific document version
   * GET /documents/versions/:versionId/status
   */
  @Get('versions/:versionId/status')
  async getVersionStatus(
    @Param('versionId') versionId: string,
  ): Promise<{ versionId: string; status: string }> {
    this.logger.debug(`Version status request for ${versionId}`);
    return this.ingestionService.getVersionStatus(versionId);
  }

  /**
   * Get queue statistics
   * GET /documents/queue/stats
   */
  @Get('queue/stats')
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return this.ingestionService.getQueueStats();
  }

  /**
   * Pause the ingestion queue
   * POST /documents/queue/pause
   */
  @Post('queue/pause')
  @HttpCode(HttpStatus.OK)
  async pauseQueue(): Promise<{ message: string }> {
    this.logger.log('Queue pause requested');
    await this.ingestionService.pauseQueue();
    return { message: 'Queue paused successfully' };
  }

  /**
   * Resume the ingestion queue
   * POST /documents/queue/resume
   */
  @Post('queue/resume')
  @HttpCode(HttpStatus.OK)
  async resumeQueue(): Promise<{ message: string }> {
    this.logger.log('Queue resume requested');
    await this.ingestionService.resumeQueue();
    return { message: 'Queue resumed successfully' };
  }
}
