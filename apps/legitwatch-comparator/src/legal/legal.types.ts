/**
 * legal.types.ts
 * Shared types for the Legal Patch Engine.
 * ALL interfaces are additive — nothing in the existing system is removed.
 */

// ─── Comparison Mode ────────────────────────────────────────────────────────

export enum ComparisonMode {
  /** Two complete versions of the same law (before/after) */
  FULL = 'FULL',
  /** Base law (full) + amendatory law with patch instructions */
  PATCH = 'PATCH',
}

export interface ModeClassification {
  mode: ComparisonMode;
  confidence: number; // 0-1
  triggers: string[]; // which heuristics fired
  ratioModifierToBase: number;
}

// ─── Law AST ────────────────────────────────────────────────────────────────

export type LawNodeType =
  | 'LAW'
  | 'CHAPTER'
  | 'SECTION'
  | 'ARTICLE'
  | 'PARAGRAPH'
  | 'INCISO'
  | 'LITERAL'
  | 'NUMERAL'
  | 'TRANSITORIO'
  | 'PREAMBLE';

export interface LawNode {
  id: string;           // e.g. "ART_5", "SEC_2", "INC_c", "TRANS_1"
  type: LawNodeType;
  label: string;        // e.g. "Artículo 5", "Inciso (a)"
  /** Normalized label used for lookup (lowercase, no accents, no punctuation) */
  normalizedLabel: string;
  title?: string;       // Optional title text on same line as label
  content: string;      // Full text of this node (including children)
  ownText: string;      // Text belonging only to this node (excluding child text)
  children: LawNode[];
  orderIndex: number;
  startOffset: number;
  endOffset: number;
  contentHash: string;  // SHA256 of normalized content (for caching/dedup)
}

export interface LawAST {
  root: LawNode;
  /** Flat index: normalizedLabel → node (for O(1) lookup) */
  index: Map<string, LawNode>;
  /** Original raw text */
  rawText: string;
  /** Normalized text used for parsing */
  normalizedText: string;
}

// ─── Patch Operations ────────────────────────────────────────────────────────

export type PatchOpType =
  | 'REPLACE'         // Replace content of target node
  | 'INSERT_AFTER'    // Insert new node after target
  | 'INSERT_BEFORE'   // Insert new node before target
  | 'DELETE'          // Remove target node entirely
  | 'RENUMBER'        // Renumber a series of nodes
  | 'AMEND_PARTIAL';  // Partial text replacement within a node

export interface PatchOp {
  type: PatchOpType;
  /** Target node ID (resolved) */
  targetId?: string;
  /** Target label as found in modifier text */
  targetLabel: string;
  /** New text to insert/replace with */
  newText?: string;
  /** For RENUMBER: mapping old label → new label */
  renumberMap?: Record<string, string>;
  /** For AMEND_PARTIAL: the specific phrase to replace */
  targetPhrase?: string;
  /** Confidence of target resolution (1.0 = exact match, <1.0 = fuzzy) */
  confidence: number;
  /** Original instruction text from the modifier */
  evidence: string;
  /** Whether this op needs human review */
  needsReview: boolean;
  reviewReason?: string;
}

// ─── Patch Application Result ────────────────────────────────────────────────

export interface PatchApplicationReport {
  applied: PatchOp[];
  skipped: PatchOp[];
  needsReview: PatchOp[];
  consolidatedText: string;
  auditLog: Array<{
    op: PatchOpType;
    target: string;
    status: 'applied' | 'skipped' | 'review';
    reason?: string;
  }>;
}

// ─── Localized Diff ──────────────────────────────────────────────────────────

export interface AffectedUnit {
  id: string;
  label: string;
  type: LawNodeType;
  changeKind: 'modified' | 'added' | 'deleted' | 'renumbered';
  /** Character-level diff HTML for this unit */
  diffHtml: string;
  sourceSideHtml: string;
  targetSideHtml: string;
  /** Context snippet (300-800 chars) around the change */
  context?: string;
  impactScore?: number;
  changeType?: string;
}

// ─── Full Comparison Result ──────────────────────────────────────────────────

export interface LegalComparisonResult {
  mode: ComparisonMode;
  modeClassification: ModeClassification;
  /** Only populated in PATCH mode */
  operations?: PatchOp[];
  patchReport?: PatchApplicationReport;
  /** Hierarchical diff — one entry per affected article/section */
  affectedUnits: AffectedUnit[];
  /** Summary bullets (from LLM or rule-based fallback) */
  summary: string;
  impactScore: number;
  /**
   * In PATCH mode: the fully consolidated base law text after applying all ops.
   * Feed this into the existing diff pipeline as the "target" text.
   */
  consolidatedText?: string;
  /** Raw diff HTML for the full document (backwards-compat with existing UI) */
  fullDiffHtml: string;
  sourceSideHtml: string;
  targetSideHtml: string;
}
