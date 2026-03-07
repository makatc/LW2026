import { Injectable, Logger } from '@nestjs/common';
import { LawParserService } from './law-parser.service';
import { LawAST, LawNode, PatchOp, PatchOpType } from './legal.types';

/**
 * PatchExtractorService
 * Extracts PatchOp[] from an amendatory law (modifier) AST.
 *
 * Strategy: for each article in the modifier, scan its text for
 * instruction patterns (enmiéndase, derogase, añadase, etc.) and
 * determine what operation to emit.
 */
@Injectable()
export class PatchExtractorService {
  private readonly logger = new Logger(PatchExtractorService.name);

  constructor(private readonly parser: LawParserService) {}

  /**
   * Extract operations from modifier text.
   * @param modifierText  Raw text of the amendatory law
   * @param baseAst       AST of the base law (used to resolve target IDs)
   */
  extract(modifierText: string, baseAst: LawAST): PatchOp[] {
    const modifierAst = this.parser.parse(modifierText);
    const ops: PatchOp[] = [];

    // Walk every leaf-ish node in the modifier
    const walk = (node: LawNode) => {
      if (node.type !== 'LAW') {
        const extracted = this.extractFromNode(node, baseAst);
        ops.push(...extracted);
      }
      node.children.forEach(walk);
    };

    modifierAst.root.children.forEach(walk);

    this.logger.log(`Extracted ${ops.length} patch operations from modifier`);
    return ops;
  }

  // ─── Instruction patterns ─────────────────────────────────────────────────

  /** Pattern: target label references */
  // private readonly TARGET_REF = /(?:el|la|los|las)?\s*(?:Artículo|ARTÍCULO|Artículo|Art\.|Sección|SECCIÓN|Inciso|INCISO|Párrafo|PÁRRAFO|Capítulo|CAPÍTULO)\s+([\dA-Za-záéíóúÁÉÍÓÚüÜñÑ]+(?:\s*[-–]\s*[\dA-Za-z]+)?)/gi;

  /** Finds the first structural reference in text, returns raw label */
  private findTargetRef(text: string): string | null {
    const m = text.match(
      /(?:el\s+)?(?:Artículo|ARTÍCULO|Art\.|Sección|SECCIÓN|Inciso|INCISO|Párrafo|PÁRRAFO|Capítulo|CAPÍTULO)\s+([\dA-Za-z]+(?:\s*[-–]\s*[\dA-Za-z]+)?)/i,
    );
    if (!m) return null;
    return m[0].trim(); // e.g. "Artículo 5"
  }

  /** Extract "para que lea: …" new text content */
  private extractNewText(text: string): string | null {
    // Pattern 1: "para que lea:" or "para que diga:"
    const m1 = text.match(/para\s+que\s+(?:lea|diga)[:\s]+(.+)/is);
    if (m1) return m1[1].trim();

    // Pattern 2: léase: / léase como:
    const m2 = text.match(/lé?ase(?:\s+como)?[:\s]+(.+)/is);
    if (m2) return m2[1].trim();

    // Pattern 3: block after the instruction verb (last resort)
    const m3 = text.match(/(?:quede\s+redactado\s+(?:así|como\s+sigue))[:\s]*(.+)/is);
    if (m3) return m3[1].trim();

    return null;
  }

  private extractFromNode(node: LawNode, baseAst: LawAST): PatchOp[] {
    const ops: PatchOp[] = [];
    const text = node.content;

    // ── REPLACE (enmiéndase, sustitúyase, modifícase) ──────────────────────
    if (/\benmié?ndase\b|\bsustitú?yase\b|\bmodifí?case\b/i.test(text)) {
      const targetLabel = this.findTargetRef(text);
      if (targetLabel) {
        const newText = this.extractNewText(text);
        const targetId = this.resolveTargetId(targetLabel, baseAst);
        ops.push({
          type: 'REPLACE',
          targetId: targetId ?? undefined,
          targetLabel,
          newText: newText ?? node.ownText,
          confidence: targetId ? 1.0 : 0.6,
          evidence: text.substring(0, 300),
          needsReview: !targetId || !newText,
          reviewReason: !targetId
            ? 'Target not found in base law'
            : !newText
              ? 'New text not clearly delimited'
              : undefined,
        });
      }
    }

    // ── DELETE (derógase, elímínase, se elimina) ────────────────────────────
    else if (/\bderógase\b|\bderóganse\b|\belimí?nase\b|\bse\s+elimina\b/i.test(text)) {
      // May target multiple articles: "deróganse los Artículos 5, 7 y 9"
      const refs = this.findAllTargetRefs(text);
      for (const ref of refs) {
        const targetId = this.resolveTargetId(ref, baseAst);
        ops.push({
          type: 'DELETE',
          targetId: targetId ?? undefined,
          targetLabel: ref,
          confidence: targetId ? 1.0 : 0.6,
          evidence: text.substring(0, 300),
          needsReview: !targetId,
          reviewReason: !targetId ? 'Target not found in base law' : undefined,
        });
      }
    }

    // ── INSERT_AFTER (añádase, insértase, incorpórese) ──────────────────────
    else if (/\bañá?dase\b|\binsé?rtase\b|\bincorpó?rese\b|\bse\s+añade\b|\bse\s+inserta\b/i.test(text)) {
      const targetLabel = this.findTargetRef(text);
      const newText = this.extractNewText(text) ?? node.ownText;
      const targetId = targetLabel ? this.resolveTargetId(targetLabel, baseAst) : null;

      // If "antes del" → INSERT_BEFORE
      const opType: PatchOpType = /antes\s+del?\b/i.test(text) ? 'INSERT_BEFORE' : 'INSERT_AFTER';

      ops.push({
        type: opType,
        targetId: targetId ?? undefined,
        targetLabel: targetLabel ?? node.label,
        newText,
        confidence: targetId ? 0.9 : 0.5,
        evidence: text.substring(0, 300),
        needsReview: !targetId,
        reviewReason: !targetId ? 'Insertion anchor not found in base law' : undefined,
      });
    }

    // ── RENUMBER (rénúmerese, renuméranse) ─────────────────────────────────
    else if (/\brenu?mé?rese\b|\brenu?mé?rense\b/i.test(text)) {
      const renumberMap = this.extractRenumberMap(text);
      ops.push({
        type: 'RENUMBER',
        targetLabel: node.label,
        renumberMap,
        confidence: Object.keys(renumberMap).length > 0 ? 0.8 : 0.4,
        evidence: text.substring(0, 300),
        needsReview: Object.keys(renumberMap).length === 0,
        reviewReason:
          Object.keys(renumberMap).length === 0
            ? 'Could not extract renumber mapping'
            : undefined,
      });
    }

    // ── AMEND_PARTIAL (frase/palabra ... se sustituye por / se cambia por) ──
    else if (/la\s+(?:frase|expresión|palabra)\s+[""«].+?[""»]\s+se\s+(?:sustituye|cambia)\s+por\b/i.test(text)) {
      const phraseMatch = text.match(
        /la\s+(?:frase|expresión|palabra)\s+[""«](.+?)[""»]\s+se\s+(?:sustituye|cambia)\s+por\s+[""«](.+?)[""»]/i,
      );
      const targetLabel = this.findTargetRef(text) ?? node.label;
      const targetId = this.resolveTargetId(targetLabel, baseAst);

      if (phraseMatch) {
        ops.push({
          type: 'AMEND_PARTIAL',
          targetId: targetId ?? undefined,
          targetLabel,
          targetPhrase: phraseMatch[1],
          newText: phraseMatch[2],
          confidence: targetId ? 0.95 : 0.5,
          evidence: text.substring(0, 300),
          needsReview: !targetId,
          reviewReason: !targetId ? 'Target node not found in base law' : undefined,
        });
      }
    }

    return ops;
  }

  /** Find ALL structural references in a text (for multi-target derogatories). */
  private findAllTargetRefs(text: string): string[] {
    const refs: string[] = [];
    const re =
      /(?:Artículo|ARTÍCULO|Art\.|Sección|SECCIÓN|Inciso|INCISO|Párrafo|PÁRRAFO)\s+([\dA-Za-z]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      refs.push(m[0].trim());
    }
    return [...new Set(refs)];
  }

  /**
   * Attempt to extract a "from → to" renumber mapping from text.
   * Example: "el Artículo 5 pasará a ser el Artículo 6"
   */
  private extractRenumberMap(text: string): Record<string, string> {
    const map: Record<string, string> = {};
    // Pattern: "Artículo X pasará a ser Artículo Y" or "Artículo X como Artículo Y"
    const re =
      /(?:Artículo|Art\.)\s+(\d+[A-Za-z]?)\s+(?:pasará\s+a\s+ser|como)\s+(?:el\s+)?(?:Artículo|Art\.)\s+(\d+[A-Za-z]?)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      map[`Artículo ${m[1]}`] = `Artículo ${m[2]}`;
    }
    return map;
  }

  /**
   * Resolve a raw label like "Artículo 5" to a node ID in the base AST.
   * Uses the parser's normalizeLabel for fuzzy matching.
   */
  private resolveTargetId(label: string, baseAst: LawAST): string | null {
    const normalized = this.parser.normalizeLabel(label);
    const node = baseAst.index.get(normalized);
    if (node) return node.id;

    // Try partial match: "Artículo 5A" might be indexed as "articulo 5a"
    for (const [key, node] of baseAst.index) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return node.id;
      }
    }

    return null;
  }
}
