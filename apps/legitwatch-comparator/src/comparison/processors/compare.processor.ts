import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import {
  DocumentVersion,
  DocumentChunk,
  ComparisonResult,
  ComparisonStatus,
} from '../../entities';
import { DiffService } from '../services/diff.service';
import { StubSemanticChangeDetector } from '../interfaces';
import type { SemanticChangeDetector } from '../interfaces';
import type { ComparisonJobData, ComparisonJobResult } from '../dto';

/**
 * CompareProcessor
 * BullMQ processor that handles document comparison jobs
 * Compares two document versions chunk by chunk
 */
@Processor('comparison-queue', {
  concurrency: 1, // Process 1 comparison at a time (can be CPU intensive)
})
export class CompareProcessor extends WorkerHost {
  private readonly logger = new Logger(CompareProcessor.name);
  private readonly semanticDetector: SemanticChangeDetector;

  constructor(
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepository: Repository<DocumentChunk>,
    @InjectRepository(ComparisonResult)
    private readonly comparisonRepository: Repository<ComparisonResult>,
    private readonly diffService: DiffService,
  ) {
    super();
    // For now, use stub detector. Later can inject AI-based detector
    this.semanticDetector = new StubSemanticChangeDetector();
  }

  async process(job: Job<ComparisonJobData>): Promise<ComparisonJobResult> {
    const startTime = Date.now();
    const { sourceVersionId, targetVersionId, detectSemanticChanges } = job.data;

    this.logger.log(
      `Processing comparison job ${job.id}: ${sourceVersionId} vs ${targetVersionId}`,
    );

    try {
      // Step 1: Fetch versions
      const [sourceVersion, targetVersion] = await Promise.all([
        this.versionRepository.findOne({ where: { id: sourceVersionId } }),
        this.versionRepository.findOne({ where: { id: targetVersionId } }),
      ]);

      if (!sourceVersion) {
        throw new Error(`Source version ${sourceVersionId} not found`);
      }
      if (!targetVersion) {
        throw new Error(`Target version ${targetVersionId} not found`);
      }

      // Step 2: Fetch chunks for both versions
      const [sourceChunks, targetChunks] = await Promise.all([
        this.chunkRepository.find({
          where: { versionId: sourceVersionId },
          order: { orderIndex: 'ASC' },
        }),
        this.chunkRepository.find({
          where: { versionId: targetVersionId },
          order: { orderIndex: 'ASC' },
        }),
      ]);

      this.logger.debug(
        `Comparing ${sourceChunks.length} source chunks with ${targetChunks.length} target chunks`,
      );

      // Step 3: Align chunks (simple by label for now)
      const alignmentMap = this.alignChunks(sourceChunks, targetChunks);

      // Step 4: Compare aligned chunks
      const chunkComparisons = await this.compareAlignedChunks(
        sourceChunks,
        targetChunks,
        alignmentMap,
        detectSemanticChanges,
      );

      // Step 5: Calculate overall impact score
      const impactScore = this.calculateOverallImpactScore(chunkComparisons);

      // Step 6: Generate summary
      const summary = this.generateSummary(chunkComparisons);

      // Step 7: Create ComparisonResult
      const comparison = this.comparisonRepository.create({
        sourceVersionId,
        targetVersionId,
        status: ComparisonStatus.COMPLETED,
        alignmentMap,
        chunkComparisons,
        summary,
        impactScore,
        metadata: {
          sourceChunkCount: sourceChunks.length,
          targetChunkCount: targetChunks.length,
          alignedChunkCount: Object.keys(alignmentMap).length,
        },
      });

      const savedComparison = await this.comparisonRepository.save(comparison);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Comparison completed: ${chunkComparisons.length} chunks compared in ${processingTime}ms`,
      );

      return {
        comparisonId: savedComparison.id,
        sourceVersionId,
        targetVersionId,
        chunksCompared: chunkComparisons.length,
        processingTimeMs: processingTime,
        impactScore,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Comparison failed: ${error}`);

      // Try to create error record
      try {
        const comparison = this.comparisonRepository.create({
          sourceVersionId,
          targetVersionId,
          status: ComparisonStatus.ERROR,
          alignmentMap: {},
          chunkComparisons: [],
          summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
          impactScore: 0,
        });
        await this.comparisonRepository.save(comparison);
      } catch (saveError) {
        this.logger.error(`Failed to save error record: ${saveError}`);
      }

      return {
        comparisonId: '',
        sourceVersionId,
        targetVersionId,
        chunksCompared: 0,
        processingTimeMs: Date.now() - startTime,
        impactScore: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Align chunks between source and target versions
   * Simple label-based alignment for now
   */
  private alignChunks(
    sourceChunks: DocumentChunk[],
    targetChunks: DocumentChunk[],
  ): Record<string, string> {
    const alignmentMap: Record<string, string> = {};

    // Create a map of target chunks by label for quick lookup
    const targetByLabel = new Map<string, DocumentChunk>();
    for (const chunk of targetChunks) {
      targetByLabel.set(chunk.label.toLowerCase(), chunk);
    }

    // Try to find matches by label
    for (const sourceChunk of sourceChunks) {
      const targetChunk = targetByLabel.get(sourceChunk.label.toLowerCase());
      if (targetChunk) {
        alignmentMap[sourceChunk.id] = targetChunk.id;
      }
    }

    return alignmentMap;
  }

  /**
   * Compare aligned chunks and generate diffs
   */
  private async compareAlignedChunks(
    sourceChunks: DocumentChunk[],
    targetChunks: DocumentChunk[],
    alignmentMap: Record<string, string>,
    detectSemanticChanges: boolean = false,
  ): Promise<Array<{
    sourceChunkId: string;
    targetChunkId: string;
    diffHtml: string;
    changeType?: string;
    impactScore?: number;
  }>> {
    const comparisons: Array<{
      sourceChunkId: string;
      targetChunkId: string;
      diffHtml: string;
      changeType?: string;
      impactScore?: number;
    }> = [];

    // Create lookup maps
    const targetById = new Map(targetChunks.map((c) => [c.id, c]));

    for (const sourceChunk of sourceChunks) {
      const targetChunkId = alignmentMap[sourceChunk.id];
      if (!targetChunkId) continue;

      const targetChunk = targetById.get(targetChunkId);
      if (!targetChunk) continue;

      // Generate diff
      const diffResult = this.diffService.generateDiff(
        sourceChunk.content,
        targetChunk.content,
      );

      let changeType: string | undefined;
      let impactScore: number | undefined;

      // Optionally detect semantic changes
      if (detectSemanticChanges) {
        const semanticChanges = await this.semanticDetector.detectChanges(
          sourceChunk.content,
          targetChunk.content,
          { label: sourceChunk.label },
        );

        if (semanticChanges.length > 0) {
          changeType = semanticChanges[0].type;
          impactScore = this.semanticDetector.calculateImpactScore(semanticChanges);
        }
      }

      comparisons.push({
        sourceChunkId: sourceChunk.id,
        targetChunkId: targetChunk.id,
        diffHtml: diffResult.htmlDiff,
        changeType,
        impactScore,
      });
    }

    return comparisons;
  }

  /**
   * Calculate overall impact score from chunk comparisons
   */
  private calculateOverallImpactScore(
    comparisons: Array<{ impactScore?: number }>,
  ): number {
    const scores = comparisons
      .map((c) => c.impactScore)
      .filter((s): s is number => s !== undefined);

    if (scores.length === 0) return 0;

    // Use average for now, could use weighted average in future
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average);
  }

  /**
   * Generate summary of changes
   */
  private generateSummary(
    comparisons: Array<{ changeType?: string }>,
  ): string {
    const changeTypes = comparisons
      .map((c) => c.changeType)
      .filter((t): t is string => t !== undefined);

    if (changeTypes.length === 0) {
      return `${comparisons.length} chunks compared with text differences.`;
    }

    const typeCounts = changeTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryParts = Object.entries(typeCounts).map(
      ([type, count]) => `${count} ${type.replace(/_/g, ' ')}`,
    );

    return `${comparisons.length} chunks compared: ${summaryParts.join(', ')}.`;
  }
}
