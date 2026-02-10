import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComparisonResult } from '../entities/comparison-result.entity';
import { DocumentVersion } from '../entities/document-version.entity';

export interface ProjectSummary {
  comparisonId: string;
  status: string;
  sourceDocument: {
    id: string;
    title: string;
    versionId: string;
    versionTag: string;
  };
  targetDocument: {
    id: string;
    title: string;
    versionId: string;
    versionTag: string;
  };
  summary?: string;
  impactScore: number;
  totalChanges: number;
  chunkComparisons: Array<{
    sourceChunkId: string;
    targetChunkId: string;
    diffHtml: string;
    changeType?: string;
    impactScore?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ComparisonResult)
    private readonly comparisonRepo: Repository<ComparisonResult>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
  ) {}

  /**
   * Get a detailed project summary including comparison results
   */
  async getProjectSummary(comparisonId: string): Promise<ProjectSummary> {
    this.logger.log(`Generating summary for comparison ${comparisonId}`);

    const comparison = await this.comparisonRepo.findOne({
      where: { id: comparisonId },
    });

    if (!comparison) {
      throw new NotFoundException(
        `Comparison with ID ${comparisonId} not found`,
      );
    }

    // Fetch source and target versions with their documents
    const sourceVersion = await this.versionRepo.findOne({
      where: { id: comparison.sourceVersionId },
      relations: ['document'],
    });

    const targetVersion = await this.versionRepo.findOne({
      where: { id: comparison.targetVersionId },
      relations: ['document'],
    });

    if (!sourceVersion || !targetVersion) {
      throw new NotFoundException('Source or target version not found');
    }

    const summary: ProjectSummary = {
      comparisonId: comparison.id,
      status: comparison.status,
      sourceDocument: {
        id: sourceVersion.document.id,
        title: sourceVersion.document.title,
        versionId: sourceVersion.id,
        versionTag: sourceVersion.versionTag,
      },
      targetDocument: {
        id: targetVersion.document.id,
        title: targetVersion.document.title,
        versionId: targetVersion.id,
        versionTag: targetVersion.versionTag,
      },
      summary: comparison.summary,
      impactScore: comparison.impactScore,
      totalChanges: comparison.chunkComparisons.length,
      chunkComparisons: comparison.chunkComparisons,
      createdAt: comparison.createdAt,
      updatedAt: comparison.updatedAt,
    };

    this.logger.log(
      `Summary generated with ${summary.totalChanges} chunk comparisons`,
    );

    return summary;
  }

  /**
   * Export comparison results to PDF (mock implementation)
   */
  async exportToPdf(comparisonId: string): Promise<{
    message: string;
    comparisonId: string;
    status: string;
  }> {
    this.logger.log(`PDF export requested for comparison ${comparisonId}`);

    // Verify the comparison exists
    const comparison = await this.comparisonRepo.findOne({
      where: { id: comparisonId },
    });

    if (!comparison) {
      throw new NotFoundException(
        `Comparison with ID ${comparisonId} not found`,
      );
    }

    // Mock implementation - in production, this would queue a PDF generation job
    return {
      message: 'PDF Generation Pending',
      comparisonId: comparisonId,
      status: 'queued',
    };
  }

  /**
   * Get comparison result raw data
   */
  async getComparisonResult(comparisonId: string): Promise<ComparisonResult> {
    const comparison = await this.comparisonRepo.findOne({
      where: { id: comparisonId },
    });

    if (!comparison) {
      throw new NotFoundException(
        `Comparison with ID ${comparisonId} not found`,
      );
    }

    return comparison;
  }
}
