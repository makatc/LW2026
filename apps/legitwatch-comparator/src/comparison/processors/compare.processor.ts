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
import { LegalComparatorService } from '../../legal/legal-comparator.service';
import { ComparisonMode } from '../../legal/legal.types';

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
    private readonly legalComparator: LegalComparatorService,
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

      await job.updateProgress(10);

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

      await job.updateProgress(20);

      // Step 2b: Legal Patch Engine (feature-flagged)
      // When enabled, reconstruct full text from chunks and run the patch engine.
      // If mode === PATCH, we save results directly and skip the normal diff pipeline.
      if (process.env.LEGAL_PATCH_ENGINE_ENABLED === 'true') {
        const baseText = sourceChunks.map((c) => c.content).join('\n\n');
        const modifierText = targetChunks.map((c) => c.content).join('\n\n');

        const legal = await this.legalComparator.compare(baseText, modifierText);

        if (legal.mode === ComparisonMode.PATCH) {
          this.logger.log(
            `PATCH mode detected (confidence ${legal.modeClassification.confidence.toFixed(2)}), saving patch result`,
          );

          const chunkComparisons = legal.affectedUnits.map((u) => ({
            sourceChunkId: u.id,
            targetChunkId: u.id,
            label: u.label,
            diffHtml: u.diffHtml,
            sourceSideHtml: u.sourceSideHtml,
            targetSideHtml: u.targetSideHtml,
            changeType: u.changeKind,
            impactScore: u.impactScore,
          }));

          const comparison = this.comparisonRepository.create({
            sourceVersionId,
            targetVersionId,
            status: ComparisonStatus.COMPLETED,
            alignmentMap: {},
            chunkComparisons,
            summary: legal.summary,
            impactScore: legal.impactScore,
            metadata: {
              legalMode: legal.mode,
              modeClassification: legal.modeClassification,
              patchReport: legal.patchReport,
              operationCount: legal.operations?.length ?? 0,
              sourceTitle,
              targetTitle,
            },
          });

          const saved = await this.comparisonRepository.save(comparison);
          const processingTime = Date.now() - startTime;

          return {
            comparisonId: saved.id,
            sourceVersionId,
            targetVersionId,
            chunksCompared: chunkComparisons.length,
            processingTimeMs: processingTime,
            impactScore: legal.impactScore,
            success: true,
          };
        }
        // FULL mode → fall through to existing pipeline below
      }

      // Step 3: Align chunks by label + Jaccard similarity
      const alignmentMap = this.alignChunks(sourceChunks, targetChunks);

      // Step 4: Compare aligned chunks (unified + side-by-side) + surface unmatched chunks
      const chunkComparisons = await this.compareAlignedChunks(
        sourceChunks,
        targetChunks,
        alignmentMap,
        detectSemanticChanges,
      );

      await job.updateProgress(60);

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

      await job.updateProgress(80);

      // Step 7: Extract added/removed text for stakeholder analysis
      const { addedText, removedText } = this.extractAddedRemovedText(chunkComparisons);
      const stakeholderAnalysis = await this.llmAnalysisService.analyzeStakeholders(
        addedText,
        removedText,
        `${sourceTitle} → ${targetTitle}`,
      );

      await job.updateProgress(90);

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

  /**
   * Align source chunks to target chunks using a 3-tier strategy:
   *
   * Tier 1 — Exact normalized label match  (e.g. "artículo 5" == "ART. 5")
   * Tier 2 — Jaccard content similarity    (catches rewritten/renumbered articles)
   * Tier 3 — Positional (index-based)      (last resort for generic PDFs)
   *
   * Returns a map of sourceChunkId → targetChunkId.
   */
  private alignChunks(
    sourceChunks: DocumentChunk[],
    targetChunks: DocumentChunk[],
  ): Record<string, string> {
    const alignmentMap: Record<string, string> = {};
    const usedTargetIds = new Set<string>();

    // --- Tier 1: normalized label matching ---
    const targetByNormalizedLabel = new Map<string, DocumentChunk>();
    for (const chunk of targetChunks) {
      const key = this.normalizeLabel(chunk.label);
      if (!targetByNormalizedLabel.has(key)) {
        targetByNormalizedLabel.set(key, chunk);
      }
    }

    for (const sourceChunk of sourceChunks) {
      const key = this.normalizeLabel(sourceChunk.label);
      const targetChunk = targetByNormalizedLabel.get(key);
      if (targetChunk && !usedTargetIds.has(targetChunk.id)) {
        alignmentMap[sourceChunk.id] = targetChunk.id;
        usedTargetIds.add(targetChunk.id);
      }
    }

    const tier1Ratio = Object.keys(alignmentMap).length / (sourceChunks.length || 1);
    this.logger.debug(`Tier 1 (label) matched ${Math.round(tier1Ratio * 100)}% of chunks`);

    // --- Tier 2: Jaccard content similarity for unmatched source chunks ---
    const unmatchedSource = sourceChunks.filter((c) => !alignmentMap[c.id]);
    const unmatchedTarget = targetChunks.filter((c) => !usedTargetIds.has(c.id));

    if (unmatchedSource.length > 0 && unmatchedTarget.length > 0) {
      const JACCARD_THRESHOLD = 0.25; // at least 25% word overlap

      for (const src of unmatchedSource) {
        let bestScore = JACCARD_THRESHOLD;
        let bestTarget: DocumentChunk | null = null;

        for (const tgt of unmatchedTarget) {
          if (usedTargetIds.has(tgt.id)) continue;
          const score = this.jaccardSimilarity(src.content, tgt.content);
          if (score > bestScore) {
            bestScore = score;
            bestTarget = tgt;
          }
        }

        if (bestTarget) {
          alignmentMap[src.id] = bestTarget.id;
          usedTargetIds.add(bestTarget.id);
        }
      }

      const tier2Matched = Object.keys(alignmentMap).length - Math.round(tier1Ratio * sourceChunks.length);
      this.logger.debug(`Tier 2 (Jaccard) matched ${tier2Matched} additional chunks`);
    }

    const totalRatio = Object.keys(alignmentMap).length / (sourceChunks.length || 1);

    // --- Tier 3: positional fallback only for generic docs with very low match ---
    if (totalRatio < 0.4) {
      this.logger.warn(
        `Label+Jaccard alignment matched only ${Math.round(totalRatio * 100)}% — falling back to positional alignment`,
      );
      const positionalMap: Record<string, string> = {};
      const len = Math.min(sourceChunks.length, targetChunks.length);
      for (let i = 0; i < len; i++) {
        positionalMap[sourceChunks[i].id] = targetChunks[i].id;
      }
      return positionalMap;
    }

    this.logger.log(
      `Alignment complete: ${Object.keys(alignmentMap).length}/${sourceChunks.length} source chunks matched`,
    );
    return alignmentMap;
  }

  /**
   * Normalize a chunk label for fuzzy matching.
   * "ART. 5A" == "Artículo 5A" == "ARTÍCULO 5A"
   */
  private normalizeLabel(label: string): string {
    return label
      .toLowerCase()
      // Normalize accented chars
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Expand common abbreviations
      .replace(/\bart\.\s*/g, 'articulo ')
      .replace(/\bcap\.\s*/g, 'capitulo ')
      .replace(/\bsec\.\s*/g, 'seccion ')
      // Remove punctuation and extra spaces
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Jaccard similarity between two text strings (word-level bag-of-words).
   * Returns a value in [0, 1].
   */
  private jaccardSimilarity(a: string, b: string): number {
    const wordsOf = (text: string): Set<string> => {
      const tokens = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3); // skip stop words / short tokens
      return new Set(tokens);
    };

    const setA = wordsOf(a);
    const setB = wordsOf(b);

    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return intersection / union;
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
    const matchedTargetIds = new Set(Object.values(alignmentMap));

    for (const sourceChunk of sourceChunks) {
      const targetChunkId = alignmentMap[sourceChunk.id];

      if (!targetChunkId) {
        // Source chunk has no match in target → REMOVED
        const removedDiff = this.diffService.generateDiff(sourceChunk.content, '');
        const removedSide = this.diffService.generateSideBySideDiff(sourceChunk.content, '');
        comparisons.push({
          sourceChunkId: sourceChunk.id,
          targetChunkId: '',
          label: sourceChunk.label,
          diffHtml: removedDiff.htmlDiff,
          sourceSideHtml: removedSide.oldHtml,
          targetSideHtml: removedSide.newHtml,
          changeType: 'removed',
          impactScore: 80,
        });
        continue;
      }

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

    // Target chunks with no source match → ADDED
    for (const targetChunk of targetChunks) {
      if (!matchedTargetIds.has(targetChunk.id)) {
        const addedDiff = this.diffService.generateDiff('', targetChunk.content);
        const addedSide = this.diffService.generateSideBySideDiff('', targetChunk.content);
        comparisons.push({
          sourceChunkId: '',
          targetChunkId: targetChunk.id,
          label: targetChunk.label,
          diffHtml: addedDiff.htmlDiff,
          sourceSideHtml: addedSide.oldHtml,
          targetSideHtml: addedSide.newHtml,
          changeType: 'added',
          impactScore: 80,
        });
      }
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
