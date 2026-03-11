import { Injectable, Logger } from '@nestjs/common';
import { LawParserService } from './law-parser.service';
import { ModeClassifierService } from './mode-classifier.service';
import { PatchExtractorService } from './patch-extractor.service';
import { PatchApplierService } from './patch-applier.service';
import { LocalizedDiffService } from './localized-diff.service';
import {
  ComparisonMode,
  LegalComparisonResult,
  ModeClassification,
} from './legal.types';

/**
 * LegalComparatorService
 * Main entry point for the Legal Patch Engine.
 *
 * Given two raw texts (base law + modifier/target), it:
 *   1. Classifies the comparison mode (FULL vs PATCH)
 *   2. If PATCH:
 *      a. Parses both texts into ASTs
 *      b. Extracts PatchOps from the modifier
 *      c. Applies ops to the base → consolidated text
 *      d. Returns the consolidated text for the existing diff pipeline
 *      e. Returns per-article AffectedUnit[] for structured display
 *   3. If FULL:
 *      a. Parses both texts into ASTs
 *      b. Diffs each article pair
 *      c. Returns AffectedUnit[]
 *
 * The "consolidatedText" returned in PATCH mode is the fully amended
 * version of the base law, which can be dropped straight into the
 * existing CompareProcessor's chunk-comparison pipeline.
 */
@Injectable()
export class LegalComparatorService {
  private readonly logger = new Logger(LegalComparatorService.name);

  constructor(
    private readonly parser: LawParserService,
    private readonly classifier: ModeClassifierService,
    private readonly extractor: PatchExtractorService,
    private readonly applier: PatchApplierService,
    private readonly localDiff: LocalizedDiffService,
  ) {}

  /**
   * Compare two law texts.
   * Returns a LegalComparisonResult which includes:
   *  - mode / modeClassification
   *  - affectedUnits (per article/section diffs)
   *  - consolidatedText (for PATCH mode → feed into existing pipeline)
   *  - patchReport (ops applied/skipped)
   */
  async compare(
    baseText: string,
    modifierText: string,
    overrideMode?: ComparisonMode,
  ): Promise<LegalComparisonResult> {
    const enabled = process.env.LEGAL_PATCH_ENGINE_ENABLED === 'true';
    if (!enabled && !overrideMode) {
      // Engine disabled — return stub so caller can fall back to the
      // regular diff pipeline unchanged.
      return this.stubResult(baseText, modifierText);
    }

    const modeClassification: ModeClassification = overrideMode
      ? {
          mode: overrideMode,
          confidence: 1.0,
          triggers: ['override'],
          ratioModifierToBase: modifierText.length / Math.max(baseText.length, 1),
        }
      : this.classifier.classify(baseText, modifierText);

    this.logger.log(
      `LegalComparator: mode=${modeClassification.mode} confidence=${modeClassification.confidence.toFixed(2)}`,
    );

    if (modeClassification.mode === ComparisonMode.PATCH) {
      return this.runPatchMode(baseText, modifierText, modeClassification);
    } else {
      return this.runFullMode(baseText, modifierText, modeClassification);
    }
  }

  // ─── PATCH mode ────────────────────────────────────────────────────────────

  private async runPatchMode(
    baseText: string,
    modifierText: string,
    modeClassification: ModeClassification,
  ): Promise<LegalComparisonResult> {
    const baseAst = this.parser.parse(baseText);
    const ops = this.extractor.extract(modifierText, baseAst);

    this.logger.log(`PATCH mode: ${ops.length} operations extracted`);

    const patchReport = this.applier.apply(baseAst, ops);
    const consolidatedText = patchReport.consolidatedText;

    const affectedUnits = this.localDiff.fromPatch(baseAst, consolidatedText, ops);

    // Impact score: weighted by operation type
    const impactScore = this.computePatchImpactScore(ops, affectedUnits);

    return {
      mode: ComparisonMode.PATCH,
      modeClassification,
      operations: ops,
      patchReport,
      affectedUnits,
      summary: this.buildPatchSummary(ops, patchReport),
      impactScore,
      // consolidatedText is what the existing pipeline should diff against baseText
      consolidatedText,
      fullDiffHtml: '',
      sourceSideHtml: '',
      targetSideHtml: '',
    };
  }

  // ─── FULL mode ─────────────────────────────────────────────────────────────

  private async runFullMode(
    baseText: string,
    targetText: string,
    modeClassification: ModeClassification,
  ): Promise<LegalComparisonResult> {
    const baseAst = this.parser.parse(baseText);
    const targetAst = this.parser.parse(targetText);

    const affectedUnits = this.localDiff.fromFullComparison(baseAst, targetAst);
    const impactScore = affectedUnits.length
      ? Math.round(
          affectedUnits.reduce((s, u) => s + (u.impactScore ?? 0), 0) /
            affectedUnits.length,
        )
      : 0;

    return {
      mode: ComparisonMode.FULL,
      modeClassification,
      affectedUnits,
      summary: `${affectedUnits.length} artículos/secciones con cambios detectados.`,
      impactScore,
      consolidatedText: targetText,
      fullDiffHtml: '',
      sourceSideHtml: '',
      targetSideHtml: '',
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private computePatchImpactScore(
    ops: import('./legal.types').PatchOp[],
    units: import('./legal.types').AffectedUnit[],
  ): number {
    if (!ops.length) return 0;

    const opScore = ops.reduce((sum, op) => {
      const w =
        op.type === 'DELETE' ? 90 :
        op.type === 'INSERT_AFTER' || op.type === 'INSERT_BEFORE' ? 75 :
        op.type === 'REPLACE' ? 65 :
        op.type === 'AMEND_PARTIAL' ? 45 :
        op.type === 'RENUMBER' ? 20 : 30;
      return sum + w;
    }, 0) / ops.length;

    const unitScore = units.length
      ? units.reduce((s, u) => s + (u.impactScore ?? 0), 0) / units.length
      : opScore;

    return Math.round((opScore + unitScore) / 2);
  }

  private buildPatchSummary(
    ops: import('./legal.types').PatchOp[],
    report: import('./legal.types').PatchApplicationReport,
  ): string {
    const counts = ops.reduce<Record<string, number>>((acc, op) => {
      acc[op.type] = (acc[op.type] ?? 0) + 1;
      return acc;
    }, {});

    const parts: string[] = [];
    if (counts.REPLACE) parts.push(`${counts.REPLACE} artículo(s) enmendado(s)`);
    if (counts.DELETE) parts.push(`${counts.DELETE} artículo(s) derogado(s)`);
    if (counts.INSERT_AFTER || counts.INSERT_BEFORE)
      parts.push(`${(counts.INSERT_AFTER ?? 0) + (counts.INSERT_BEFORE ?? 0)} artículo(s) añadido(s)`);
    if (counts.RENUMBER) parts.push(`renumeración de artículos`);
    if (counts.AMEND_PARTIAL) parts.push(`${counts.AMEND_PARTIAL} enmienda(s) parcial(es)`);

    const summary = parts.length ? parts.join(', ') : 'sin cambios detectados';
    const review = report.needsReview.length
      ? ` (${report.needsReview.length} requiere revisión manual)`
      : '';

    return `Ley modificadora: ${summary}${review}.`;
  }

  private stubResult(
    baseText: string,
    modifierText: string,
  ): LegalComparisonResult {
    return {
      mode: ComparisonMode.FULL,
      modeClassification: {
        mode: ComparisonMode.FULL,
        confidence: 0,
        triggers: ['engine_disabled'],
        ratioModifierToBase: modifierText.length / Math.max(baseText.length, 1),
      },
      affectedUnits: [],
      summary: '',
      impactScore: 0,
      consolidatedText: modifierText,
      fullDiffHtml: '',
      sourceSideHtml: '',
      targetSideHtml: '',
    };
  }
}
