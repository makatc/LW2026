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

    const old = oldText.toLowerCase();
    const nw = newText.toLowerCase();

    // Obligation shift: deberá → podrá (must → may) or reverse
    if (old.includes('deberá') && nw.includes('podrá')) {
      changes.push({
        type: SemanticChangeType.OBLIGATION_SHIFT,
        description: 'Obligación debilitada: "deberá" cambiado a "podrá"',
        impactScore: 75,
        confidence: 0.85,
        oldText,
        newText,
        reasoning: 'Detected change from "deberá" to "podrá"',
      });
    } else if (old.includes('podrá') && nw.includes('deberá')) {
      changes.push({
        type: SemanticChangeType.OBLIGATION_SHIFT,
        description: 'Obligación reforzada: "podrá" cambiado a "deberá"',
        impactScore: 70,
        confidence: 0.85,
        oldText,
        newText,
        reasoning: 'Detected change from "podrá" to "deberá"',
      });
    }

    // Sanction changes
    const sanctionKeywords = ['multa', 'sanción', 'sanciones', 'pena', 'penalidad', 'penalidades', 'reclusión', 'arresto'];
    const oldHasSanction = sanctionKeywords.some((k) => old.includes(k));
    const newHasSanction = sanctionKeywords.some((k) => nw.includes(k));
    if (oldHasSanction !== newHasSanction) {
      changes.push({
        type: SemanticChangeType.SANCTION_CHANGED,
        description: newHasSanction ? 'Sanción añadida al texto' : 'Sanción eliminada del texto',
        impactScore: 85,
        confidence: 0.7,
        oldText,
        newText,
      });
    } else if (oldHasSanction && newHasSanction) {
      // Both have sanctions — check if amounts changed (e.g. $5,000 → $10,000)
      const amountPattern = /\$[\d,]+/g;
      const oldAmounts = oldText.match(amountPattern) ?? [];
      const newAmounts = newText.match(amountPattern) ?? [];
      if (JSON.stringify(oldAmounts) !== JSON.stringify(newAmounts)) {
        changes.push({
          type: SemanticChangeType.SANCTION_CHANGED,
          description: `Monto de sanción modificado: ${oldAmounts.join(', ')} → ${newAmounts.join(', ')}`,
          impactScore: 80,
          confidence: 0.9,
          oldText,
          newText,
        });
      }
    }

    // Definition changes
    const definitionKeywords = ['se define', 'se entiende por', 'significa', 'se entenderá', 'se define como', '"significa"'];
    const oldHasDef = definitionKeywords.some((k) => old.includes(k));
    const newHasDef = definitionKeywords.some((k) => nw.includes(k));
    if ((oldHasDef || newHasDef) && oldText !== newText) {
      changes.push({
        type: SemanticChangeType.DEFINITION_MODIFIED,
        description: 'Definición legal modificada',
        impactScore: 65,
        confidence: 0.75,
        oldText,
        newText,
      });
    }

    // Scope expansion
    const expansionKeywords = ['incluyendo pero no limitado a', 'así como', 'y cualquier', 'incluyendo sin limitación', 'entre otros', 'y/o', 'o cualquier otro'];
    const oldExpansion = expansionKeywords.filter((k) => old.includes(k)).length;
    const newExpansion = expansionKeywords.filter((k) => nw.includes(k)).length;
    if (newExpansion > oldExpansion) {
      changes.push({
        type: SemanticChangeType.SCOPE_EXPANDED,
        description: 'Alcance ampliado: se añadieron términos de expansión',
        impactScore: 60,
        confidence: 0.7,
        oldText,
        newText,
      });
    }

    // Scope reduction
    const restrictionKeywords = ['únicamente', 'exclusivamente', 'solo', 'solamente', 'limitado a', 'restringido a', 'no aplicará'];
    const oldRestriction = restrictionKeywords.filter((k) => old.includes(k)).length;
    const newRestriction = restrictionKeywords.filter((k) => nw.includes(k)).length;
    if (newRestriction > oldRestriction) {
      changes.push({
        type: SemanticChangeType.SCOPE_REDUCED,
        description: 'Alcance reducido: se añadieron términos restrictivos',
        impactScore: 65,
        confidence: 0.7,
        oldText,
        newText,
      });
    }

    // New requirements
    const requirementKeywords = ['quedan obligados', 'vendrán obligados', 'se requerirá', 'se exigirá', 'será requisito', 'deberán presentar', 'deberán obtener'];
    const oldHasReq = requirementKeywords.some((k) => old.includes(k));
    const newHasReq = requirementKeywords.some((k) => nw.includes(k));
    if (!oldHasReq && newHasReq) {
      changes.push({
        type: SemanticChangeType.REQUIREMENT_ADDED,
        description: 'Nuevo requisito añadido',
        impactScore: 70,
        confidence: 0.8,
        oldText,
        newText,
      });
    } else if (oldHasReq && !newHasReq) {
      changes.push({
        type: SemanticChangeType.REQUIREMENT_REMOVED,
        description: 'Requisito eliminado',
        impactScore: 70,
        confidence: 0.8,
        oldText,
        newText,
      });
    }

    // Exemptions
    const exemptionKeywords = ['quedan exentos', 'estarán exentos', 'no aplicará a', 'no aplica a', 'quedan exceptuados', 'están exceptuados'];
    const oldHasExempt = exemptionKeywords.some((k) => old.includes(k));
    const newHasExempt = exemptionKeywords.some((k) => nw.includes(k));
    if (oldHasExempt !== newHasExempt) {
      changes.push({
        type: newHasExempt ? SemanticChangeType.SCOPE_REDUCED : SemanticChangeType.SCOPE_EXPANDED,
        description: newHasExempt ? 'Exención añadida' : 'Exención eliminada',
        impactScore: 75,
        confidence: 0.8,
        oldText,
        newText,
      });
    }

    // Deadline changes: detect numeric day/month/year modifications
    const deadlinePattern = /(\d+)\s*(días?|meses?|años?|horas?)/gi;
    const oldDeadlines = [...oldText.matchAll(deadlinePattern)].map((m) => m[0]);
    const newDeadlines = [...newText.matchAll(deadlinePattern)].map((m) => m[0]);
    if (oldDeadlines.length > 0 || newDeadlines.length > 0) {
      if (JSON.stringify(oldDeadlines) !== JSON.stringify(newDeadlines)) {
        changes.push({
          type: SemanticChangeType.DEADLINE_CHANGED,
          description: `Plazo modificado: ${oldDeadlines.join(', ') || 'ninguno'} → ${newDeadlines.join(', ') || 'ninguno'}`,
          impactScore: 70,
          confidence: 0.85,
          oldText,
          newText,
        });
      }
    }

    // Default: generic change with moderate score
    if (changes.length === 0) {
      const lengthDiff = Math.abs(newText.length - oldText.length);
      const changeRatio = lengthDiff / Math.max(oldText.length, 1);
      const score = Math.min(50, Math.round(30 + changeRatio * 40));
      changes.push({
        type: SemanticChangeType.NO_SEMANTIC_CHANGE,
        description: 'Cambio de texto sin patrón semántico específico detectado',
        impactScore: score,
        confidence: 0.4,
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
