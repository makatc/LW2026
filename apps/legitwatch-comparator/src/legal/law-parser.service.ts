import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { LawAST, LawNode, LawNodeType } from './legal.types';

interface RawSegment {
  type: LawNodeType;
  id: string;
  label: string;
  normalizedLabel: string;
  title: string;
  text: string;
  orderIndex: number;
  startOffset: number;
  endOffset: number;
}

/**
 * LawParserService
 * Builds a hierarchical AST from raw legal text.
 * Handles Puerto Rico legislative conventions (Spanish).
 *
 * Hierarchy: LAW → CHAPTER → ARTICLE → SECTION → PARAGRAPH/INCISO/LITERAL
 */
@Injectable()
export class LawParserService {
  private readonly logger = new Logger(LawParserService.name);

  /** Ordered from highest to lowest priority in hierarchy */
  private readonly PATTERNS: Array<{
    type: LawNodeType;
    re: RegExp;
    idPrefix: string;
    labelFn: (m: RegExpMatchArray) => string;
  }> = [
    {
      type: 'CHAPTER',
      re: /^(CAP[ÍI]TULO|CAPITULO)\s+([IVXivx]+|\d+)\.?\s*[-–—]?\s*/im,
      idPrefix: 'CAP',
      labelFn: (m) => `Capítulo ${m[2].toUpperCase()}`,
    },
    {
      type: 'TRANSITORIO',
      re: /^(DISPOSICI[ÓO]N\s+TRANSITORIA|TRANSITORIO|TRANSITORIA)\s*([IVXivx]+|\d+|PRIMERO|SEGUNDO|TERCERO)?\s*[-–—]?\s*/im,
      idPrefix: 'TRANS',
      labelFn: (m) => `Transitorio ${m[2] ?? ''}`.trim(),
    },
    {
      type: 'ARTICLE',
      re: /^(ART[ÍI]CULO|ARTICULO|Art\.)\s+(\d+[A-Za-z]?)\.?\s*[-–—]?\s*/im,
      idPrefix: 'ART',
      labelFn: (m) => `Artículo ${m[2].toUpperCase()}`,
    },
    {
      type: 'SECTION',
      re: /^(SECCI[ÓO]N|SECCION)\s+([IVXivx]+|\d+|Primera|Segunda|Tercera|Cuarta|Quinta)\.?\s*[-–—]?\s*/im,
      idPrefix: 'SEC',
      labelFn: (m) => `Sección ${m[2]}`,
    },
    {
      type: 'PARAGRAPH',
      re: /^(P[ÁA]RRAFO|PARAGRAFO)\s+([IVXivx]+|\d+|primero|segundo|tercero)\.?\s*[-–—]?\s*/im,
      idPrefix: 'PAR',
      labelFn: (m) => `Párrafo ${m[2]}`,
    },
    {
      type: 'INCISO',
      re: /^(INCISO|Inciso)\s+\(?([a-z])\)?\.?\s*/im,
      idPrefix: 'INC',
      labelFn: (m) => `Inciso (${m[2].toLowerCase()})`,
    },
    {
      type: 'LITERAL',
      re: /^(LITERAL|Literal)\s+([A-Za-z])\.?\s*/im,
      idPrefix: 'LIT',
      labelFn: (m) => `Literal ${m[2].toUpperCase()}`,
    },
  ];

  /** Level order for hierarchy building (higher number = deeper) */
  private readonly LEVEL: Record<LawNodeType, number> = {
    LAW: 0,
    PREAMBLE: 1,
    CHAPTER: 2,
    TRANSITORIO: 2,
    ARTICLE: 3,
    SECTION: 4,
    PARAGRAPH: 5,
    INCISO: 6,
    LITERAL: 7,
    NUMERAL: 7,
  };

  /**
   * Parse raw text into a LawAST.
   * Returns a flat index for O(1) lookups by normalized label.
   */
  parse(rawText: string): LawAST {
    const normalized = this.normalize(rawText);
    const segments = this.segment(normalized);
    const root = this.buildTree(segments, normalized);
    const index = this.buildIndex(root);

    this.logger.log(
      `Parsed law: ${segments.length} segments, ${index.size} indexed nodes`,
    );

    return { root, index, rawText, normalizedText: normalized };
  }

  // ─── Normalization ──────────────────────────────────────────────────────

  normalize(text: string): string {
    return text
      // Windows line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Soft hyphens / line-break hyphens
      .replace(/\u00AD/g, '')
      // Curly quotes → straight
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Em/en dash → hyphen for consistency in patterns
      .replace(/[\u2013\u2014]/g, '-')
      // Collapse multiple blank lines to exactly two
      .replace(/\n{3,}/g, '\n\n')
      // Trim trailing whitespace on each line
      .split('\n').map((l) => l.trimEnd()).join('\n')
      .trim();
  }

  // ─── Segmentation ───────────────────────────────────────────────────────

  private segment(text: string): RawSegment[] {
    const segments: RawSegment[] = [];
    const lines = text.split('\n');
    let currentSeg: Partial<RawSegment> | null = null;
    let currentLines: string[] = [];
    let offset = 0;
    let orderIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      const detected = trimmed ? this.detectHeader(trimmed) : null;

      if (detected) {
        // Flush current segment
        if (currentSeg && currentLines.length > 0) {
          segments.push(this.finalizeSeg(currentSeg, currentLines, orderIndex++));
        }
        currentSeg = {
          type: detected.type,
          id: detected.id,
          label: detected.label,
          normalizedLabel: this.normalizeLabel(detected.label),
          title: detected.title,
          startOffset: offset,
        };
        currentLines = detected.title ? [detected.title] : [];
      } else if (currentSeg) {
        if (trimmed) currentLines.push(trimmed);
      } else if (trimmed) {
        // Pre-amble text before any structural marker
        if (!currentSeg) {
          currentSeg = {
            type: 'PREAMBLE',
            id: 'PREAMBLE',
            label: 'Preámbulo',
            normalizedLabel: 'preambulo',
            title: '',
            startOffset: offset,
          };
          currentLines = [trimmed];
        }
      }

      offset += line.length + 1;
    }

    // Flush last segment
    if (currentSeg && currentLines.length > 0) {
      segments.push(this.finalizeSeg(currentSeg, currentLines, orderIndex));
    }

    return segments;
  }

  private finalizeSeg(
    seg: Partial<RawSegment>,
    lines: string[],
    orderIndex: number,
  ): RawSegment {
    const text = lines.join('\n').trim();
    return {
      ...(seg as RawSegment),
      text,
      orderIndex,
      endOffset: (seg.startOffset ?? 0) + text.length,
    };
  }

  private detectHeader(line: string): {
    type: LawNodeType;
    id: string;
    label: string;
    title: string;
  } | null {
    for (const p of this.PATTERNS) {
      const m = line.match(p.re);
      if (m) {
        const label = p.labelFn(m);
        const id = `${p.idPrefix}_${m[2]?.toUpperCase() ?? String(Date.now())}`;
        const title = line.substring(m[0].length).trim();
        return { type: p.type, id, label, title };
      }
    }
    return null;
  }

  // ─── Tree Building ──────────────────────────────────────────────────────

  private buildTree(segments: RawSegment[], fullText: string): LawNode {
    const root: LawNode = {
      id: 'LAW',
      type: 'LAW',
      label: 'Ley',
      normalizedLabel: 'ley',
      content: fullText,
      ownText: '',
      children: [],
      orderIndex: 0,
      startOffset: 0,
      endOffset: fullText.length,
      contentHash: this.hash(fullText),
    };

    // Stack-based tree builder
    const stack: LawNode[] = [root];

    for (const seg of segments) {
      const node: LawNode = {
        id: this.deduplicateId(seg.id, stack),
        type: seg.type,
        label: seg.label,
        normalizedLabel: seg.normalizedLabel,
        title: seg.title,
        content: seg.text,
        ownText: seg.text,
        children: [],
        orderIndex: seg.orderIndex,
        startOffset: seg.startOffset,
        endOffset: seg.endOffset,
        contentHash: this.hash(seg.text),
      };

      const segLevel = this.LEVEL[seg.type] ?? 5;

      // Pop stack until parent level < node level
      while (stack.length > 1) {
        const top = stack[stack.length - 1];
        const topLevel = this.LEVEL[top.type] ?? 5;
        if (topLevel < segLevel) break;
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      parent.children.push(node);
      stack.push(node);
    }

    return root;
  }

  /** Ensure IDs are unique within the tree (handle ART_5 appearing twice). */
  private deduplicateId(id: string, stack: LawNode[]): string {
    // Build a set of all IDs in the current tree
    const allIds = new Set<string>();
    const collect = (n: LawNode) => {
      allIds.add(n.id);
      n.children.forEach(collect);
    };
    stack.forEach(collect);

    if (!allIds.has(id)) return id;

    let suffix = 2;
    while (allIds.has(`${id}_${suffix}`)) suffix++;
    return `${id}_${suffix}`;
  }

  // ─── Index ──────────────────────────────────────────────────────────────

  private buildIndex(root: LawNode): Map<string, LawNode> {
    const index = new Map<string, LawNode>();
    const walk = (node: LawNode) => {
      // Primary key: normalized label ("artículo 5")
      index.set(node.normalizedLabel, node);
      // Secondary key: node ID ("ART_5")
      index.set(node.id.toLowerCase(), node);
      node.children.forEach(walk);
    };
    root.children.forEach(walk);
    return index;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  normalizeLabel(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\bart\.\s*/g, 'articulo ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hash(text: string): string {
    return createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
  }

  /**
   * Reconstruct plain text from the AST (for applying patches).
   * Preserves article/section headers.
   */
  reconstructText(node: LawNode, depth = 0): string {
    if (node.type === 'LAW') {
      return node.children.map((c) => this.reconstructText(c, 0)).join('\n\n');
    }

    const header = node.title
      ? `${node.label} — ${node.title}`
      : node.label;

    const childText = node.children.length > 0
      ? '\n' + node.children.map((c) => this.reconstructText(c, depth + 1)).join('\n\n')
      : '';

    const ownText = node.ownText.trim();
    const body = ownText ? `${ownText}${childText}` : childText.trim();

    return `${header}\n${body}`;
  }
}
