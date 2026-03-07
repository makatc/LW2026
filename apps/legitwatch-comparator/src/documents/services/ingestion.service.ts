import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue, QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DocumentVersion, DocumentVersionStatus } from '../../entities';
import type { IngestionJobData, IngestionJobResult } from '../dto';

export interface JobStatusInfo {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress?: number;
  result?: IngestionJobResult;
  error?: string;
}

/**
 * IngestionService
 * Manages the ingestion queue and provides methods to queue documents
 * for processing and check job status
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue('ingestion-queue')
    private readonly ingestionQueue: Queue<IngestionJobData, IngestionJobResult>,
    private readonly configService: ConfigService,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
  ) {
    // Create QueueEvents for listening to job completion
    this.queueEvents = new QueueEvents('ingestion-queue', {
      connection: {
        host: this.configService.get('REDIS_HOST') || 'localhost',
        port: this.configService.get('REDIS_PORT') || 6379,
      },
    });
  }

  /**
   * Queue a document for ingestion
   * @param snapshotId SourceSnapshot UUID
   * @param versionTag Optional version tag
   * @returns Job ID
   */
  async queueIngestion(
    snapshotId: string,
    versionTag?: string,
    extras?: { fileBufferBase64?: string; originalFileName?: string },
  ): Promise<string> {
    this.logger.log(`Queueing ingestion for snapshot ${snapshotId}`);

    const job = await this.ingestionQueue.add(
      'ingest-document',
      { snapshotId, versionTag, ...extras },
      {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
      },
    );

    this.logger.log(`Ingestion job queued with ID: ${job.id}`);

    return job.id!;
  }

  /**
   * Get the status of a job
   * @param jobId Job ID
   * @returns Job status information
   */
  async getJobStatus(jobId: string): Promise<JobStatusInfo> {
    try {
      const job = await this.ingestionQueue.getJob(jobId);

      if (!job) {
        return {
          jobId,
          status: 'unknown',
        };
      }

      const state = await job.getState();
      const progress = job.progress;

      let status: JobStatusInfo['status'];
      switch (state) {
        case 'completed':
          status = 'completed';
          break;
        case 'failed':
          status = 'failed';
          break;
        case 'active':
          status = 'active';
          break;
        case 'waiting':
          status = 'waiting';
          break;
        case 'delayed':
          status = 'delayed';
          break;
        default:
          status = 'unknown';
      }

      return {
        jobId,
        status,
        progress: typeof progress === 'number' ? progress : undefined,
        result: status === 'completed' ? job.returnvalue : undefined,
        error: status === 'failed' ? job.failedReason : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}: ${error}`);
      throw error;
    }
  }

  /**
   * Wait for a job to complete
   * @param jobId Job ID
   * @param timeoutMs Timeout in milliseconds (default 60s)
   * @returns Job result
   */
  async waitForJob(jobId: string, timeoutMs: number = 60000): Promise<IngestionJobResult> {
    const job = await this.ingestionQueue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      const result = await job.waitUntilFinished(this.queueEvents, timeoutMs);
      return result;
    } catch (error) {
      this.logger.error(`Job ${jobId} failed or timed out: ${error}`);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.ingestionQueue.getJobCounts();

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Pause the queue (useful for maintenance)
   */
  async pauseQueue(): Promise<void> {
    await this.ingestionQueue.pause();
    this.logger.log('Ingestion queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.ingestionQueue.resume();
    this.logger.log('Ingestion queue resumed');
  }

  /**
   * Clear all jobs from the queue (use with caution!)
   */
  async clearQueue(): Promise<void> {
    await this.ingestionQueue.obliterate();
    this.logger.warn('Ingestion queue cleared');
  }

  /**
   * Get the processing status of a specific document version
   * @param versionId DocumentVersion UUID
   * @returns status and versionId
   */
  async getVersionStatus(
    versionId: string,
  ): Promise<{ versionId: string; status: DocumentVersionStatus }> {
    const version = await this.versionRepository.findOne({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException(`Version ${versionId} not found`);
    }
    return { versionId, status: version.status };
  }
}
