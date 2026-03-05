import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import {
  DocumentVersion,
  DocumentVersionStatus,
  DocumentChunk,
  ComparisonResult,
  ComparisonStatus,
} from '../../entities';
import { DiffService } from '../services/diff.service';
import { LlmAnalysisService } from '../services/llm-analysis.service';
import { StubSemanticChangeDetector } from '../interfaces';
import type { SemanticChangeDetector } from '../interfaces';
import type { ComparisonJobData, ComparisonJobResult } from '../dto';

@Processor('comparison-queue', {
  concurrency: 1,
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
    private readonly llmAnalysisService: LlmAnalysisService,
  ) {
    super();
    this.semanticDetector = new StubSemanticChangeDetector();
  }

  async process(job: Job<ComparisonJobData>): Promise<ComparisonJobResult> {
    const startTime = Date.now();
    const { sourceVersionId, targetVersionId, detectSemanticChanges } = job.data;

    this.logger.log(
      `Processing comparison job ${job.id}: ${sourceVersionId} vs ${targetVersionId}`,
    );

    try {
      // Step 1: Fetch versions with related documents
      const [sourceVersion, targetVersion] = await Promise.all([
        this.versionRepository.findOne({
          where: { id: sourceVersionId },
          relations: ['document'],
        }),
        this.versionRepository.findOne({
          where: { id: targetVersionId },
          relations: ['document'],
        }),
      ]);

      if (!sourceVersion) throw new Error(`Source version ${sourceVersionId} not found`);
      if (!targetVersion) throw new Error(`Target version ${targetVersionId} not found`);

      // Guard: ensure both versions finished ingestion before accessing chunks
      if (sourceVersion.status !== DocumentVersionStatus.READY) {
        throw new Error(
          `Source version ${sourceVersionId} is not ready (status: ${sourceVersion.status}). Wait for ingestion to complete.`,
        );
      }
      if (targetVersion.status !== DocumentVersionStatus.READY) {
        throw new Error(
          `Target version ${targetVersionId} is not ready (status: ${targetVersion.status}). Wait for ingestion to complete.`,
        );
      }

      const sourceTitle = sourceVersion.document?.title ?? 'Documento Original';
      const targetTitle = targetVersion.document?.title ?? 'Documento Nuevo';

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

      // Step 3: Align chunks by label
      const alignmentMap = this.alignChunks(sourceChunks, targetChunks);

      // Step 4: Compare aligned chunks (unified + side-by-side)
      const chunkComparisons = await this.compareAlignedChunks(
        sourceChunks,
        targetChunks,
        alignmentMap,
        detectSemanticChanges,
      );

      // Step 5: Calculate overall impact score
      const impactScore = this.calculateOverallImpactScore(chunkComparisons);

      // Step 6: Generate AI executive summary
      const aiSummary = await this.llmAnalysisService.generateExecutiveSummary(
        chunkComparisons.map((c) => ({
          label: c.label ?? `Chunk ${c.sourceChunkId.slice(0, 8)}`,
          diffHtml: c.diffHtml,
          changeType: c.changeType,
        })),
        sourceTitle,
        targetTitle,
      );

      // Step 7: Extract added/removed text for stakeholder analysis
      const { addedText, removedText } = this.extractAddedRemovedText(chunkComparisons);
      const stakeholderAnalysis = await this.llmAnalysisService.analyzeStakeholders(
        addedText,
        removedText,
        `${sourceTitle} → ${targetTitle}`,
      );

      // Step 8: Save ComparisonResult
      const comparison = this.comparisonRepository.create({
        sourceVersionId,
        targetVersionId,
        status: ComparisonStatus.COMPLETED,
        alignmentMap,
        chunkComparisons,
        summary: aiSummary,
        impactScore,
        metadata: {
          sourceChunkCount: sourceChunks.length,
          targetChunkCount: targetChunks.length,
          alignedChunkCount: Object.keys(alignmentMap).length,
          stakeholderAnalysis,
          sourceTitle,
          targetTitle,
        },
      });

      const savedComparison = await this.comparisonRepository.save(comparison);
      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Comparison completed: ${chunkComparisons.length} chunks in ${processingTime}ms`,
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

  private alignChunks(
    sourceChunks: DocumentChunk[],
    targetChunks: DocumentChunk[],
  ): Record<string, string> {
    const alignmentMap: Record<string, string> = {};

    // Attempt label-based alignment first
    const targetByLabel = new Map<string, DocumentChunk>();
    for (const chunk of targetChunks) {
      // Only add first occurrence so early chunks aren't shadowed by later ones
      if (!targetByLabel.has(chunk.label.toLowerCase())) {
        targetByLabel.set(chunk.label.toLowerCase(), chunk);
      }
    }
    for (const sourceChunk of sourceChunks) {
      const targetChunk = targetByLabel.get(sourceChunk.label.toLowerCase());
      if (targetChunk) {
        alignmentMap[sourceChunk.id] = targetChunk.id;
      }
    }

    // Fallback: if fewer than 50 % of source chunks matched by label,
    // use positional (index-based) alignment instead so generic PDFs
    // (labelled "Párrafo 1", "Párrafo 2" …) are still fully compared.
    const matchRatio = Object.keys(alignmentMap).length / (sourceChunks.length || 1);
    if (matchRatio < 0.5) {
      this.logger.warn(
        `Label-based alignment matched only ${Math.round(matchRatio * 100)}% of chunks — falling back to positional alignment`,
      );
      const positionalMap: Record<string, string> = {};
      const len = Math.min(sourceChunks.length, targetChunks.length);
      for (let i = 0; i < len; i++) {
        positionalMap[sourceChunks[i].id] = targetChunks[i].id;
      }
      return positionalMap;
    }

    return alignmentMap;
  }

  private async compareAlignedChunks(
    sourceChunks: DocumentChunk[],
    targetChunks: DocumentChunk[],
    alignmentMap: Record<string, string>,
    detectSemanticChanges: boolean = false,
  ): Promise<
    Array<{
      sourceChunkId: string;
      targetChunkId: string;
      label?: string;
      diffHtml: string;
      sourceSideHtml: string;
      targetSideHtml: string;
      changeType?: string;
      impactScore?: number;
    }>
  > {
    const comparisons: Array<{
      sourceChunkId: string;
      targetChunkId: string;
      label?: string;
      diffHtml: string;
      sourceSideHtml: string;
      targetSideHtml: string;
      changeType?: string;
      impactScore?: number;
    }> = [];

    const targetById = new Map(targetChunks.map((c) => [c.id, c]));

    for (const sourceChunk of sourceChunks) {
      const targetChunkId = alignmentMap[sourceChunk.id];
      if (!targetChunkId) continue;

      const targetChunk = targetById.get(targetChunkId);
      if (!targetChunk) continue;

      // Generate unified diff (redline)
      const diffResult = this.diffService.generateDiff(
        sourceChunk.content,
        targetChunk.content,
      );

      // Generate side-by-side diff
      const sideBySide = this.diffService.generateSideBySideDiff(
        sourceChunk.content,
        targetChunk.content,
      );

      let changeType: string | undefined;
      let impactScore: number | undefined;

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
        label: sourceChunk.label,
        diffHtml: diffResult.htmlDiff,
        sourceSideHtml: sideBySide.oldHtml,
        targetSideHtml: sideBySide.newHtml,
        changeType,
        impactScore,
      });
    }

    return comparisons;
  }

  private calculateOverallImpactScore(
    comparisons: Array<{ impactScore?: number }>,
  ): number {
    const scores = comparisons
      .map((c) => c.impactScore)
      .filter((s): s is number => s !== undefined);

    if (scores.length === 0) return 0;

    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return Math.round(average);
  }

  private extractAddedRemovedText(
    comparisons: Array<{ sourceSideHtml: string; targetSideHtml: string }>,
  ): { addedText: string; removedText: string } {
    const extractIns = (html: string) => {
      const matches = html.match(/<ins>([\s\S]*?)<\/ins>/gi) ?? [];
      return matches.map((m) => m.replace(/<\/?ins>/gi, '')).join(' ');
    };

    const extractDel = (html: string) => {
      const matches = html.match(/<del>([\s\S]*?)<\/del>/gi) ?? [];
      return matches.map((m) => m.replace(/<\/?del>/gi, '')).join(' ');
    };

    const addedText = comparisons
      .map((c) => extractIns(c.targetSideHtml))
      .join(' ')
      .substring(0, 4000);

    const removedText = comparisons
      .map((c) => extractDel(c.sourceSideHtml))
      .join(' ')
      .substring(0, 4000);

    return { addedText, removedText };
  }
}
