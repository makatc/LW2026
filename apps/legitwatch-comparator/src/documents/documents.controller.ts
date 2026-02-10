import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IngestionService, JobStatusInfo } from './services/ingestion.service';
import { IngestDocumentDto } from './dto';

/**
 * DocumentsController
 * Handles HTTP endpoints for document ingestion and processing
 */
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly ingestionService: IngestionService) {}

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
