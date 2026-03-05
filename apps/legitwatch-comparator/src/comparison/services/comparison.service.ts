import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue, QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ComparisonResult } from '../../entities';
import type { ComparisonJobData, ComparisonJobResult } from '../dto';
import { DiffService } from './diff.service';

const QUICK_COMPARE_MAX_CHARS = 50_000;

export interface ComparisonJobStatusInfo {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress?: number;
  result?: ComparisonJobResult;
  error?: string;
}

/**
 * ComparisonService
 * Manages the comparison queue and provides methods to queue comparisons
 */
@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue('comparison-queue')
    private readonly comparisonQueue: Queue<ComparisonJobData, ComparisonJobResult>,
    @InjectRepository(ComparisonResult)
    private readonly comparisonRepository: Repository<ComparisonResult>,
    private readonly configService: ConfigService,
    private readonly diffService: DiffService,
  ) {
    this.queueEvents = new QueueEvents('comparison-queue', {
      connection: {
        host: this.configService.get('REDIS_HOST') || 'localhost',
        port: this.configService.get('REDIS_PORT') || 6379,
      },
    });
  }

  /**
   * Queue a comparison between two versions
   * @param sourceVersionId Source version UUID
   * @param targetVersionId Target version UUID
   * @param detectSemanticChanges Enable AI-based semantic change detection
   * @returns Job ID
   */
  async queueComparison(
    sourceVersionId: string,
    targetVersionId: string,
    detectSemanticChanges: boolean = false,
  ): Promise<string> {
    this.logger.log(
      `Queueing comparison: ${sourceVersionId} vs ${targetVersionId}`,
    );

    const job = await this.comparisonQueue.add(
      'compare-versions',
      { sourceVersionId, targetVersionId, detectSemanticChanges },
      {
        attempts: 2, // Retry once on failure
        backoff: {
          type: 'exponential',
          delay: 10000, // 10 second delay
        },
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    );

    this.logger.log(`Comparison job queued with ID: ${job.id}`);

    return job.id!;
  }

  /**
   * Get the status of a comparison job
   * @param jobId Job ID
   * @returns Job status information
   */
  async getJobStatus(jobId: string): Promise<ComparisonJobStatusInfo> {
    try {
      const job = await this.comparisonQueue.getJob(jobId);

      if (!job) {
        return {
          jobId,
          status: 'unknown',
        };
      }

      const state = await job.getState();
      const progress = job.progress;

      let status: ComparisonJobStatusInfo['status'];
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
   * Wait for a comparison job to complete
   * @param jobId Job ID
   * @param timeoutMs Timeout in milliseconds (default 120s)
   * @returns Comparison result
   */
  async waitForJob(
    jobId: string,
    timeoutMs: number = 120000,
  ): Promise<ComparisonJobResult> {
    const job = await this.comparisonQueue.getJob(jobId);

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
   * Get a comparison result by ID
   * @param comparisonId Comparison UUID
   * @returns ComparisonResult
   */
  async getComparison(comparisonId: string): Promise<ComparisonResult | null> {
    return this.comparisonRepository.findOne({
      where: { id: comparisonId },
    });
  }

  /**
   * List comparisons for a version
   * @param versionId Version UUID
   * @returns Array of comparisons
   */
  async listComparisonsForVersion(
    versionId: string,
  ): Promise<ComparisonResult[]> {
    return this.comparisonRepository.find({
      where: [
        { sourceVersionId: versionId },
        { targetVersionId: versionId },
      ],
      order: { createdAt: 'DESC' },
    });
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
    const counts = await this.comparisonQueue.getJobCounts();

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Synchronous text-to-text comparison (no queue, no DB).
   * Validates 50,000 character limit and returns diff HTML + line stats immediately.
   * Uses `diff` + `diff2html` for line-level unified diff rendering.
   */
  quickCompare(
    textA: string,
    textB: string,
  ): {
    diffHtml: string;
    sourceSideHtml: string;
    targetSideHtml: string;
    stats: {
      linesAdded: number;
      linesDeleted: number;
      linesUnchanged: number;
      changePercentage: number;
    };
  } {
    if (textA.length > QUICK_COMPARE_MAX_CHARS || textB.length > QUICK_COMPARE_MAX_CHARS) {
      throw new BadRequestException(
        'El documento supera el límite de 50,000 caracteres',
      );
    }

    // Line-level diff HTML using diff + diff2html
    const diffHtml = this.diffService.generateDiffHtml(textA, textB);
    // Line-level statistics using diff
    const lineStats = this.diffService.analyzeDiff(textA, textB);
    // Side-by-side panels still use diff-match-patch (character-level markup)
    const sideBySide = this.diffService.generateSideBySideDiff(textA, textB);

    const totalChanged = lineStats.linesAdded + lineStats.linesDeleted;
    const totalLines = lineStats.linesUnchanged + Math.max(lineStats.linesAdded, lineStats.linesDeleted);
    const changePercentage = totalLines > 0
      ? Math.round((totalChanged / totalLines) * 10000) / 100
      : 0;

    return {
      diffHtml,
      sourceSideHtml: sideBySide.oldHtml,
      targetSideHtml: sideBySide.newHtml,
      stats: {
        ...lineStats,
        changePercentage,
      },
    };
  }
}
