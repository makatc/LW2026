import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { ProjectSummary } from './reports.service';
import type { ComparisonResult } from '../entities/comparison-result.entity';

@Controller('projects')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /projects/:id/summary
   * Returns the ComparisonResult JSON with enriched document metadata
   */
  @Get(':id/summary')
  async getProjectSummary(
    @Param('id') comparisonId: string,
  ): Promise<ProjectSummary> {
    this.logger.log(`GET /projects/${comparisonId}/summary`);
    return this.reportsService.getProjectSummary(comparisonId);
  }

  /**
   * GET /projects/:id/export
   * Mock endpoint for PDF export
   */
  @Get(':id/export')
  async exportProject(@Param('id') comparisonId: string): Promise<{
    message: string;
    comparisonId: string;
    status: string;
  }> {
    this.logger.log(`GET /projects/${comparisonId}/export`);
    return this.reportsService.exportToPdf(comparisonId);
  }

  /**
   * GET /projects/:id/result
   * Returns the raw ComparisonResult entity
   */
  @Get(':id/result')
  async getComparisonResult(
    @Param('id') comparisonId: string,
  ): Promise<ComparisonResult> {
    this.logger.log(`GET /projects/${comparisonId}/result`);
    return this.reportsService.getComparisonResult(comparisonId);
  }
}
