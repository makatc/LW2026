import { Injectable, Logger } from '@nestjs/common';
import { ComparisonMode, ModeClassification } from './legal.types';

/**
 * ModeClassifierService
 * Determines whether a comparison is FULL (two complete versions)
 * or PATCH (base law + amendatory law with instructions).
 *
 * Feature flag: LEGAL_PATCH_ENGINE_ENABLED (default false)
 * When disabled, always returns FULL mode → existing pipeline unchanged.
 */
@Injectable()
export class ModeClassifierService {
  private readonly logger = new Logger(ModeClassifierService.name);

  /**
   * Ratio threshold: if modifier < this fraction of base → likely PATCH mode.
   * Configurable via PATCH_RATIO_THRESHOLD env var (default 0.25).
   */
  private readonly ratioThreshold: number;

  /** Verb patterns that signal amendatory language in Spanish legal texts */
  private readonly AMEND_VERBS = [
    /\benmié?ndase\b/i,
    /\bañá?dase\b/i,
    /\bañá?dense\b/i,
    /\bderógase\b/i,
    /\bderóganse\b/i,
    /\bsustitú?yase\b/i,
    /\bsustitú?yanse\b/i,
    /\brenu?mé?rese\b/i,
    /\brenu?mé?rense\b/i,
    /\binsé?rtase\b/i,
    /\bincorpó?rese\b/i,
    /\belimí?nase\b/i,
    /\bmodifí?case\b/i,
    /\blea\s+como\b/i,
    /\bpara\s+que\s+lea[:\s]/i,
    /\blé?ase[:\s]/i,
    /\bse\s+inserta\b/i,
    /\bse\s+elimina\b/i,
    /\bse\s+modifica\b/i,
    /\bse\s+añade\b/i,
  ];

  /** Structural reference patterns (Artículo X, Sección Y, Inciso (a)) */
  private readonly STRUCTURAL_REFS = [
    /\bArtí?culo\s+\d+[A-Z]?\b/i,
    /\bArt\.\s*\d+[A-Z]?\b/i,
    /\bSecci[oó]n\s+\d+\b/i,
    /\bInciso\s+\(?[a-z]\)?\b/i,
    /\bSub[-\s]?secci[oó]n\b/i,
    /\bLiteral\s+[A-Z]\b/i,
    /\bPárrafo\s+\d+\b/i,
  ];

  constructor() {
    this.ratioThreshold = parseFloat(
      process.env.PATCH_RATIO_THRESHOLD ?? '0.25',
    );
  }

  /**
   * Classify a comparison as FULL or PATCH.
   *
   * @param baseText   The longer/full law text
   * @param modifierText  The shorter/modifier text (or second full version)
   */
  classify(baseText: string, modifierText: string): ModeClassification {
    const ratio = modifierText.length / Math.max(baseText.length, 1);
    const triggers: string[] = [];
    let score = 0;

    // Trigger 1: size ratio
    if (ratio < this.ratioThreshold) {
      triggers.push(`ratio=${ratio.toFixed(3)} < threshold=${this.ratioThreshold}`);
      score += 0.4;
    }

    // Trigger 2: amend verbs in modifier
    for (const pattern of this.AMEND_VERBS) {
      if (pattern.test(modifierText)) {
        const verb = modifierText.match(pattern)?.[0] ?? pattern.source;
        triggers.push(`verb: "${verb}"`);
        score += 0.15;
        break; // one verb is enough for this trigger
      }
    }

    // Trigger 3: structural references in modifier
    let refCount = 0;
    for (const pattern of this.STRUCTURAL_REFS) {
      const matches = modifierText.match(new RegExp(pattern.source, 'gi')) ?? [];
      refCount += matches.length;
    }
    if (refCount >= 2) {
      triggers.push(`structural_refs=${refCount}`);
      score += 0.2;
    }

    // Trigger 4: "para que lea" or "léase" phrases
    const leaMatches = (modifierText.match(/para\s+que\s+lea|lé?ase/gi) ?? []).length;
    if (leaMatches > 0) {
      triggers.push(`"para que lea"/"léase" × ${leaMatches}`);
      score += 0.25;
    }

    // Trigger 5: modifier has NO article-like structure of its own
    // (a pure amendatory law has no "ARTÍCULO 1. Propósito" — it just modifies)
    const modifierHasOwnArticles = /^(ARTÍ?CULO|ART\.)\s+\d/im.test(modifierText);
    if (!modifierHasOwnArticles && ratio < 0.5) {
      triggers.push('modifier_has_no_own_articles');
      score += 0.1;
    }

    const confidence = Math.min(1, score);
    const mode = confidence >= 0.35 ? ComparisonMode.PATCH : ComparisonMode.FULL;

    this.logger.log(
      `Mode: ${mode} (confidence ${confidence.toFixed(2)}, ratio ${ratio.toFixed(3)})`,
    );

    return { mode, confidence, triggers, ratioModifierToBase: ratio };
  }
}
