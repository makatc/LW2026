import { Injectable, Logger } from '@nestjs/common';
import { DiffService } from '../comparison/services/diff.service';
import { LawParserService } from './law-parser.service';
import { AffectedUnit, LawAST, LawNode, PatchOp } from './legal.types';

/**
 * LocalizedDiffService
 * Produces per-article/section AffectedUnit[] by comparing:
 *   - In FULL mode: base AST node vs target AST node (by ID / normalizedLabel)
 *   - In PATCH mode: base AST node vs the same node post-patch-application
 *
 * Each AffectedUnit gets character-level diff HTML from DiffService,
 * so the existing DiffViewerPanel can render it with zero changes.
 */
@Injectable()
export class LocalizedDiffService {
  private readonly logger = new Logger(LocalizedDiffService.name);

  constructor(
    private readonly diffService: DiffService,
    private readonly parser: LawParserService,
  ) {}

  /**
   * Build AffectedUnit[] from a base AST and a consolidated (post-patch) text.
   * Used in PATCH mode.
   */
  fromPatch(baseAst: LawAST, consolidatedText: string, ops: PatchOp[]): AffectedUnit[] {
    const targetAst = this.parser.parse(consolidatedText);

    // Build a set of affected node IDs from the ops
    const affectedIds = new Set<string>(
      ops.map((op) => op.targetId ?? op.targetLabel).filter(Boolean),
    );

    const units: AffectedUnit[] = [];

    // Walk the base AST; emit AffectedUnits for nodes touched by ops
    const walk = (node: LawNode) => {
      if (node.type === 'LAW') {
        node.children.forEach(walk);
        return;
      }

      // Check if this node was targeted by an op
      const touched =
        affectedIds.has(node.id) ||
        affectedIds.has(node.normalizedLabel) ||
        ops.some(
          (op) =>
            this.parser.normalizeLabel(op.targetLabel) === node.normalizedLabel,
        );

      if (touched) {
        const targetNode =
          targetAst.index.get(node.normalizedLabel) ??
          targetAst.index.get(node.id.toLowerCase());

        const baseText = node.ownText;
        const targetText = targetNode?.ownText ?? '';

        const op = ops.find(
          (o) =>
            o.targetId === node.id ||
            this.parser.normalizeLabel(o.targetLabel) === node.normalizedLabel,
        );

        units.push(this.buildUnit(node, baseText, targetText, op?.type));
      }

      node.children.forEach(walk);
    };

    baseAst.root.children.forEach(walk);

    // Also surface nodes that were ADDED (exist in target but not in base)
    for (const [key, targetNode] of targetAst.index) {
      if (!baseAst.index.has(key) && targetNode.type !== 'LAW') {
        const op = ops.find(
          (o) =>
            o.type === 'INSERT_AFTER' || o.type === 'INSERT_BEFORE',
        );
        units.push(this.buildUnit(targetNode, '', targetNode.ownText, op?.type ?? 'INSERT_AFTER'));
      }
    }

    this.logger.log(`LocalizedDiff (PATCH): ${units.length} affected units`);
    return units;
  }

  /**
   * Build AffectedUnit[] by diffing two full-law ASTs.
   * Used in FULL mode (two complete versions).
   */
  fromFullComparison(baseAst: LawAST, targetAst: LawAST): AffectedUnit[] {
    const units: AffectedUnit[] = [];
    const visitedTargetIds = new Set<string>();

    const walkBase = (node: LawNode) => {
      if (node.type === 'LAW') {
        node.children.forEach(walkBase);
        return;
      }

      const targetNode =
        targetAst.index.get(node.normalizedLabel) ??
        targetAst.index.get(node.id.toLowerCase());

      if (targetNode) {
        visitedTargetIds.add(targetNode.normalizedLabel);

        if (node.ownText !== targetNode.ownText) {
          units.push(this.buildUnit(node, node.ownText, targetNode.ownText, 'REPLACE'));
        }
      } else {
        // Deleted
        units.push(this.buildUnit(node, node.ownText, '', 'DELETE'));
      }

      node.children.forEach(walkBase);
    };

    baseAst.root.children.forEach(walkBase);

    // Added nodes
    for (const [key, targetNode] of targetAst.index) {
      if (!visitedTargetIds.has(key) && !baseAst.index.has(key) && targetNode.type !== 'LAW') {
        units.push(this.buildUnit(targetNode, '', targetNode.ownText, 'INSERT_AFTER'));
      }
    }

    this.logger.log(`LocalizedDiff (FULL): ${units.length} affected units`);
    return units;
  }

  // ─── Unit builder ─────────────────────────────────────────────────────────

  private buildUnit(
    node: LawNode,
    baseText: string,
    targetText: string,
    opType?: string,
  ): AffectedUnit {
    const diffResult = this.diffService.generateDiff(baseText, targetText);
    const sideBySide = this.diffService.generateSideBySideDiff(baseText, targetText);

    const changeKind = this.resolveChangeKind(opType, baseText, targetText);
    const impactScore = this.scoreChange(changeKind, diffResult.changePercentage);

    return {
      id: node.id,
      label: node.label,
      type: node.type,
      changeKind,
      diffHtml: diffResult.htmlDiff,
      sourceSideHtml: sideBySide.oldHtml,
      targetSideHtml: sideBySide.newHtml,
      context: this.buildContext(baseText, targetText),
      impactScore,
      changeType: opType,
    };
  }

  private resolveChangeKind(
    opType: string | undefined,
    baseText: string,
    targetText: string,
  ): AffectedUnit['changeKind'] {
    if (opType === 'DELETE' || (!targetText && baseText)) return 'deleted';
    if (opType === 'INSERT_AFTER' || opType === 'INSERT_BEFORE' || (!baseText && targetText)) return 'added';
    if (opType === 'RENUMBER') return 'renumbered';
    return 'modified';
  }

  private scoreChange(
    kind: AffectedUnit['changeKind'],
    changePct: number,
  ): number {
    if (kind === 'deleted' || kind === 'added') return 80;
    if (kind === 'renumbered') return 30;
    // modified: scale by change percentage (cap at 90)
    return Math.min(90, Math.round(changePct * 0.9) + 20);
  }

  /** Build a 400-char context snippet showing the start of both sides */
  private buildContext(baseText: string, targetText: string): string {
    const a = baseText.substring(0, 200).trim();
    const b = targetText.substring(0, 200).trim();
    if (!a && !b) return '';
    if (!a) return `[NUEVO] ${b}`;
    if (!b) return `[ELIMINADO] ${a}`;
    return `${a} → ${b}`;
  }
}
