import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ComparisonService, ComparisonJobStatusInfo } from './services';
import { CompareVersionsDto } from './dto';
import { ComparisonResult } from '../entities';

/**
 * ComparisonController
 * Handles HTTP endpoints for document comparison
 */
@Controller('comparison')
export class ComparisonController {
  private readonly logger = new Logger(ComparisonController.name);

  constructor(private readonly comparisonService: ComparisonService) {}

  /**
   * Queue a comparison between two versions
   * POST /comparison/compare
   */
  @Post('compare')
  @HttpCode(HttpStatus.ACCEPTED)
  async compareVersions(@Body() body: CompareVersionsDto): Promise<{
    jobId: string;
    message: string;
  }> {
    this.logger.log(
      `Comparison request: ${body.sourceVersionId} vs ${body.targetVersionId}`,
    );

    try {
      const jobId = await this.comparisonService.queueComparison(
        body.sourceVersionId,
        body.targetVersionId,
        body.detectSemanticChanges,
      );

      return {
        jobId,
        message: 'Comparison queued for processing',
      };
    } catch (error) {
      this.logger.error(`Failed to queue comparison: ${error}`);
      throw error;
    }
  }

  /**
   * Get the status of a comparison job
   * GET /comparison/jobs/:jobId
   */
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string): Promise<ComparisonJobStatusInfo> {
    this.logger.debug(`Job status request for ${jobId}`);

    try {
      return await this.comparisonService.getJobStatus(jobId);
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error}`);
      throw error;
    }
  }

  /**
   * Get a completed comparison result
   * GET /comparison/results/:comparisonId
   */
  @Get('results/:comparisonId')
  async getComparisonResult(
    @Param('comparisonId') comparisonId: string,
  ): Promise<ComparisonResult | null> {
    this.logger.debug(`Comparison result request for ${comparisonId}`);

    try {
      return await this.comparisonService.getComparison(comparisonId);
    } catch (error) {
      this.logger.error(`Failed to get comparison result: ${error}`);
      throw error;
    }
  }

  /**
   * List comparisons for a version
   * GET /comparison/versions/:versionId
   */
  @Get('versions/:versionId')
  async listComparisonsForVersion(
    @Param('versionId') versionId: string,
  ): Promise<ComparisonResult[]> {
    this.logger.debug(`List comparisons for version ${versionId}`);

    try {
      return await this.comparisonService.listComparisonsForVersion(versionId);
    } catch (error) {
      this.logger.error(`Failed to list comparisons: ${error}`);
      throw error;
    }
  }

  /**
   * Synchronous text-to-text comparison (no DB, no queue)
   * POST /comparison/quick-compare
   */
  @Post('quick-compare')
  @HttpCode(HttpStatus.OK)
  quickCompare(
    @Body() body: { textA: string; textB: string },
  ): ReturnType<ComparisonService['quickCompare']> {
    if (!body?.textA || !body?.textB) {
      throw new BadRequestException('Se requieren textA y textB');
    }
    return this.comparisonService.quickCompare(body.textA, body.textB);
  }

  /**
   * Get queue statistics
   * GET /comparison/queue/stats
   */
  @Get('queue/stats')
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return this.comparisonService.getQueueStats();
  }
}
