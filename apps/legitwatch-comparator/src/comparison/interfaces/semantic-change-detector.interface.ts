/**
 * SemanticChangeType
 * Categories of semantic changes that can occur in legal documents
 */
export enum SemanticChangeType {
  OBLIGATION_SHIFT = 'obligation_shift', // deberá -> podrá (must -> may)
  SANCTION_CHANGED = 'sanction_changed', // Penalty amount or type modified
  DEFINITION_MODIFIED = 'definition_modified', // Legal definition changed
  SCOPE_EXPANDED = 'scope_expanded', // Applicability broadened
  SCOPE_REDUCED = 'scope_reduced', // Applicability narrowed
  REQUIREMENT_ADDED = 'requirement_added', // New requirement introduced
  REQUIREMENT_REMOVED = 'requirement_removed', // Requirement eliminated
  DEADLINE_CHANGED = 'deadline_changed', // Time period modified
  NO_SEMANTIC_CHANGE = 'no_semantic_change', // Text changed but meaning preserved
}

/**
 * SemanticChange
 * Represents a detected semantic change with metadata
 */
export interface SemanticChange {
  type: SemanticChangeType;
  description: string;
  impactScore: number; // 0-100
  confidence: number; // 0-1
  oldText: string;
  newText: string;
  reasoning?: string;
  affectedEntities?: string[]; // Who is affected
}

/**
 * SemanticChangeDetector
 * Interface for AI-assisted semantic change detection
 *
 * Future implementations can use:
 * - OpenAI GPT-4
 * - Anthropic Claude
 * - Local LLMs (Llama, Mistral)
 * - Custom fine-tuned models
 */
export interface SemanticChangeDetector {
  /**
   * Analyze two text chunks and detect semantic changes
   * @param oldText Original text
   * @param newText Modified text
   * @param context Additional context (article number, section, etc.)
   * @returns Array of detected semantic changes
   */
  detectChanges(
    oldText: string,
    newText: string,
    context?: Record<string, any>,
  ): Promise<SemanticChange[]>;

  /**
   * Calculate overall impact score for a set of changes
   * @param changes Array of semantic changes
   * @returns Impact score (0-100)
   */
  calculateImpactScore(changes: SemanticChange[]): number;

  /**
   * Generate human-readable summary of changes
   * @param changes Array of semantic changes
   * @returns Summary text
   */
  generateSummary(changes: SemanticChange[]): string;
}

/**
 * StubSemanticChangeDetector
 * Placeholder implementation for testing
 * Returns basic change detection without AI
 */
export class StubSemanticChangeDetector implements SemanticChangeDetector {
  async detectChanges(
    oldText: string,
    newText: string,
    _context?: Record<string, any>,
  ): Promise<SemanticChange[]> {
    // Simple heuristic-based detection (no AI)
    const changes: SemanticChange[] = [];

    // Check for no change
    if (oldText === newText) {
      return changes;
    }

    // Check for obligation shift
    if (
      oldText.toLowerCase().includes('deberá') &&
      newText.toLowerCase().includes('podrá')
    ) {
      changes.push({
        type: SemanticChangeType.OBLIGATION_SHIFT,
        description: 'Obligation weakened from "must" to "may"',
        impactScore: 75,
        confidence: 0.8,
        oldText,
        newText,
        reasoning: 'Detected change from "deberá" to "podrá"',
      });
    }

    // Check for sanctions (basic pattern matching)
    const sanctionKeywords = ['multa', 'sanción', 'pena', 'penalidad'];
    const oldHasSanction = sanctionKeywords.some((k) =>
      oldText.toLowerCase().includes(k),
    );
    const newHasSanction = sanctionKeywords.some((k) =>
      newText.toLowerCase().includes(k),
    );

    if (oldHasSanction || newHasSanction) {
      if (oldHasSanction !== newHasSanction) {
        changes.push({
          type: SemanticChangeType.SANCTION_CHANGED,
          description: newHasSanction
            ? 'Sanction added'
            : 'Sanction removed',
          impactScore: 80,
          confidence: 0.6,
          oldText,
          newText,
        });
      }
    }

    // Default: Generic change
    if (changes.length === 0) {
      changes.push({
        type: SemanticChangeType.NO_SEMANTIC_CHANGE,
        description: 'Text modified but no specific semantic change detected',
        impactScore: 30,
        confidence: 0.5,
        oldText,
        newText,
      });
    }

    return changes;
  }

  calculateImpactScore(changes: SemanticChange[]): number {
    if (changes.length === 0) return 0;

    // Weighted average based on confidence
    const totalWeightedScore = changes.reduce(
      (sum, change) => sum + change.impactScore * change.confidence,
      0,
    );
    const totalConfidence = changes.reduce(
      (sum, change) => sum + change.confidence,
      0,
    );

    return totalConfidence > 0
      ? Math.round(totalWeightedScore / totalConfidence)
      : 0;
  }

  generateSummary(changes: SemanticChange[]): string {
    if (changes.length === 0) {
      return 'No significant changes detected.';
    }

    const summaryParts = changes.map((change) => change.description);
    return summaryParts.join('; ');
  }
}
