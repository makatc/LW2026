import { Injectable, Logger } from '@nestjs/common';
import { LawParserService } from './law-parser.service';
import {
  LawAST,
  LawNode,
  PatchOp,
  PatchApplicationReport,
  PatchOpType,
} from './legal.types';

/**
 * PatchApplierService
 * Applies a list of PatchOp[] to a base LawAST in-memory, then
 * reconstructs a consolidated plain-text string that can be fed
 * into the existing diff pipeline.
 *
 * Operations are applied in-order; each op mutates a working clone
 * of the AST tree. The original AST passed in is NOT mutated.
 */
@Injectable()
export class PatchApplierService {
  private readonly logger = new Logger(PatchApplierService.name);

  constructor(private readonly parser: LawParserService) {}

  apply(baseAst: LawAST, ops: PatchOp[]): PatchApplicationReport {
    // Deep-clone just the tree structure we need to mutate
    const root = this.cloneNode(baseAst.root);
    const nodeIndex = this.buildMutableIndex(root);

    const applied: PatchOp[] = [];
    const skipped: PatchOp[] = [];
    const needsReview: PatchOp[] = [];
    const auditLog: PatchApplicationReport['auditLog'] = [];

    for (const op of ops) {
      if (op.needsReview && op.confidence < 0.7) {
        needsReview.push(op);
        auditLog.push({
          op: op.type,
          target: op.targetLabel,
          status: 'review',
          reason: op.reviewReason,
        });
        continue;
      }

      const success = this.applyOp(op, root, nodeIndex);

      if (success) {
        applied.push(op);
        auditLog.push({ op: op.type, target: op.targetLabel, status: 'applied' });
      } else {
        skipped.push(op);
        auditLog.push({
          op: op.type,
          target: op.targetLabel,
          status: 'skipped',
          reason: 'Target node not found or operation failed',
        });
      }
    }

    const consolidatedText = this.parser.reconstructText(root);

    this.logger.log(
      `Patch applied: ${applied.length} ops applied, ${skipped.length} skipped, ${needsReview.length} need review`,
    );

    return { applied, skipped, needsReview, consolidatedText, auditLog };
  }

  // ─── Apply single op ──────────────────────────────────────────────────────

  private applyOp(
    op: PatchOp,
    root: LawNode,
    index: Map<string, LawNode>,
  ): boolean {
    switch (op.type) {
      case 'REPLACE':
        return this.applyReplace(op, index);
      case 'DELETE':
        return this.applyDelete(op, root, index);
      case 'INSERT_AFTER':
      case 'INSERT_BEFORE':
        return this.applyInsert(op, root, index);
      case 'RENUMBER':
        return this.applyRenumber(op, root);
      case 'AMEND_PARTIAL':
        return this.applyAmendPartial(op, index);
      default:
        return false;
    }
  }

  private applyReplace(op: PatchOp, index: Map<string, LawNode>): boolean {
    const node = this.resolveNode(op, index);
    if (!node) return false;

    node.ownText = op.newText ?? '';
    node.content = op.newText ?? '';
    return true;
  }

  private applyDelete(
    op: PatchOp,
    root: LawNode,
    index: Map<string, LawNode>,
  ): boolean {
    const target = this.resolveNode(op, index);
    if (!target) return false;

    return this.removeNodeFromTree(root, target.id);
  }

  private applyInsert(
    op: PatchOp,
    root: LawNode,
    index: Map<string, LawNode>,
  ): boolean {
    const anchor = this.resolveNode(op, index);

    // Build a synthetic LawNode from the new text
    const newNode: LawNode = {
      id: `NEW_${Date.now()}`,
      type: 'ARTICLE',
      label: op.targetLabel,
      normalizedLabel: this.parser.normalizeLabel(op.targetLabel),
      content: op.newText ?? '',
      ownText: op.newText ?? '',
      children: [],
      orderIndex: -1,
      startOffset: 0,
      endOffset: (op.newText ?? '').length,
      contentHash: '',
    };

    if (!anchor) {
      // No anchor → append to root
      root.children.push(newNode);
      return true;
    }

    return this.insertNodeRelative(root, anchor.id, newNode, op.type);
  }

  private applyRenumber(op: PatchOp, root: LawNode): boolean {
    if (!op.renumberMap || Object.keys(op.renumberMap).length === 0) {
      return false;
    }

    let changed = false;
    const walk = (node: LawNode) => {
      const newLabel = op.renumberMap![node.label];
      if (newLabel) {
        node.label = newLabel;
        node.normalizedLabel = this.parser.normalizeLabel(newLabel);
        changed = true;
      }
      node.children.forEach(walk);
    };

    root.children.forEach(walk);
    return changed;
  }

  private applyAmendPartial(op: PatchOp, index: Map<string, LawNode>): boolean {
    if (!op.targetPhrase || !op.newText) return false;

    const node = this.resolveNode(op, index);
    if (!node) return false;

    if (!node.ownText.includes(op.targetPhrase)) return false;

    node.ownText = node.ownText.replace(op.targetPhrase, op.newText);
    node.content = node.content.replace(op.targetPhrase, op.newText);
    return true;
  }

  // ─── Tree helpers ─────────────────────────────────────────────────────────

  private resolveNode(
    op: PatchOp,
    index: Map<string, LawNode>,
  ): LawNode | null {
    if (op.targetId) {
      return index.get(op.targetId) ?? index.get(op.targetId.toLowerCase()) ?? null;
    }

    // Fallback: try normalised label
    const normalized = this.parser.normalizeLabel(op.targetLabel);
    return index.get(normalized) ?? null;
  }

  private removeNodeFromTree(parent: LawNode, targetId: string): boolean {
    const idx = parent.children.findIndex((c) => c.id === targetId);
    if (idx !== -1) {
      parent.children.splice(idx, 1);
      return true;
    }
    return parent.children.some((c) => this.removeNodeFromTree(c, targetId));
  }

  private insertNodeRelative(
    parent: LawNode,
    anchorId: string,
    newNode: LawNode,
    opType: PatchOpType,
  ): boolean {
    const idx = parent.children.findIndex((c) => c.id === anchorId);
    if (idx !== -1) {
      const insertAt = opType === 'INSERT_AFTER' ? idx + 1 : idx;
      parent.children.splice(insertAt, 0, newNode);
      return true;
    }
    return parent.children.some((c) =>
      this.insertNodeRelative(c, anchorId, newNode, opType),
    );
  }

  private buildMutableIndex(root: LawNode): Map<string, LawNode> {
    const map = new Map<string, LawNode>();
    const walk = (n: LawNode) => {
      map.set(n.id, n);
      map.set(n.id.toLowerCase(), n);
      map.set(n.normalizedLabel, n);
      n.children.forEach(walk);
    };
    walk(root);
    return map;
  }

  private cloneNode(node: LawNode): LawNode {
    return {
      ...node,
      children: node.children.map((c) => this.cloneNode(c)),
    };
  }
}
