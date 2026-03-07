import { Injectable, Logger } from '@nestjs/common';
import { DocumentChunkType } from '../../entities';

export interface DetectedChunk {
  type: DocumentChunkType;
  label: string;
  content: string;
  orderIndex: number;
  startPosition: number;
  endPosition: number;
}

/**
 * StructureDetectorService
 * Uses regex patterns and heuristics to detect and extract structural elements
 * from legal documents (Articles, Chapters, Sections, Paragraphs)
 * Supports Puerto Rico legislative document conventions.
 */
@Injectable()
export class StructureDetectorService {
  private readonly logger = new Logger(StructureDetectorService.name);

  // Regex patterns for Spanish legal documents (Puerto Rico legislative conventions)
  // Each pattern must match at the START of a trimmed line or block.
  private readonly patterns = {
    // "ARTÍCULO 1", "Artículo 2.", "Art. 3", "ARTICULO 4A"
    article: /^(ART[ÍI]CULO|Art\.|ARTICULO)\s+(\d+[A-Za-z]?)\b\.?\s*[-–—]?\s*/i,

    // "CAPÍTULO I", "Capítulo II", "CAPITULO III"
    chapter: /^(CAP[ÍI]TULO|CAPITULO)\s+([IVXivx]+|\d+)\b\.?\s*[-–—]?\s*/i,

    // "SECCIÓN 1", "Sección Primera", "SECCION I"
    section: /^(SECCI[ÓO]N|SECCION)\s+([IVXivx]+|\d+|Primera|Segunda|Tercera|Cuarta|Quinta)\b\.?\s*[-–—]?\s*/i,

    // "PÁRRAFO 1", "Párrafo primero"
    paragraph: /^(P[ÁA]RRAFO|PARAGRAFO|PAR[ÁA]GRAFO)\s+([IVXivx]+|\d+|primero|segundo|tercero)\b\.?\s*[-–—]?\s*/i,

    // "Inciso (a)", "Inciso 1.", "INCISO a)"
    inciso: /^(INCISO|Inciso)\s+([a-z]\)|[a-z]\.|\d+[\.\)])\s*/i,

    // "Literal A", "LITERAL (b)"
    literal: /^(LITERAL|Literal)\s+([A-Za-z][\.\)]?)\b\s*/i,

    // Numbered items: "1. Texto", "1) Texto", "(1) Texto" — only when ≥ 20 chars of content
    numeral: /^(\(\d+\)|\d+[\.\)])\s+([A-ZÁÉÍÓÚÑ\u00C0-\u024F])/,

    // "DISPOSICIÓN TRANSITORIA I", "Transitorio 1", "TRANSITORIO PRIMERO"
    transitorio: /^(DISPOSICI[ÓO]N\s+TRANSITORIA|TRANSITORIA|TRANSITORIO)\s*([IVXivx]+|\d+|PRIMERO|SEGUNDO|TERCERO|PRIMERO)?\b\.?\s*/i,

    // "POR CUANTO:", "POR CUANTO,"  — Whereas clauses in resolutions
    porCuanto: /^POR\s+CUANTO[,:]\s*/i,

    // "RESUÉLVASE", "RESUELTA", "BE IT RESOLVED"
    resuelva: /^(RES[UÚ]ELVASE|RESUELTA|BE\s+IT\s+RESOLVED)[,:\s]/i,

    // "EXPOSICIÓN DE MOTIVOS"
    exposicion: /^EXPOSICI[ÓO]N\s+DE\s+MOTIVOS\b/i,

    // "ENMIENDA AL ARTÍCULO 3" — amendment references
    enmienda: /^ENMIENDA\s+(AL|A\s+LA|DEL?)\s+/i,
  };

  /**
   * Detect and extract structural chunks from legal text.
   *
   * Strategy:
   * 1. Split by double-newline into "blocks" (paragraphs / logical units).
   * 2. Within each block, check the FIRST LINE for a structural marker.
   * 3. If no structural markers are found in the first pass, fall back to
   *    line-by-line scanning (handles tightly-formatted PDFs).
   *
   * @param text Raw legal document text
   * @returns Array of detected chunks with metadata
   */
  detectStructure(text: string): DetectedChunk[] {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided to structure detector');
      return [];
    }

    // --- Pass 1: block-based (double newline) ---
    const chunks = this.detectByBlocks(text);

    if (chunks.length >= 2) {
      this.logger.log(`Detected ${chunks.length} structural chunks (block pass)`);
      return chunks;
    }

    // --- Pass 2: line-by-line fallback ---
    this.logger.debug('Block pass found <2 chunks — falling back to line-by-line scan');
    const fallback = this.detectByLines(text);
    this.logger.log(`Detected ${fallback.length} structural chunks (line-by-line pass)`);
    return fallback;
  }

  /** Split by blank lines and use the first line of each block as header candidate. */
  private detectByBlocks(text: string): DetectedChunk[] {
    const blocks = text.split(/\n{2,}/);
    const chunks: DetectedChunk[] = [];
    let position = 0;

    let currentChunk: Partial<DetectedChunk> | null = null;
    let currentContent: string[] = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) {
        position += block.length + 2;
        continue;
      }

      const firstLine = trimmed.split('\n')[0].trim();
      const detected = this.detectLineType(firstLine);

      if (detected) {
        // Save previous chunk
        if (currentChunk) {
          chunks.push({
            ...currentChunk as DetectedChunk,
            content: currentContent.join('\n\n').trim(),
            endPosition: position,
          });
        }

        // Remaining content = everything after first line + rest of block
        const restOfBlock = trimmed.substring(firstLine.length).trim();
        currentChunk = {
          type: detected.type,
          label: detected.label,
          orderIndex: chunks.length,
          startPosition: position,
        };
        const bodyParts = [detected.remainingContent, restOfBlock].filter(Boolean);
        currentContent = [bodyParts.join(' ')];
      } else if (currentChunk) {
        currentContent.push(trimmed);
      } else {
        // Before any structural marker — collect as preamble paragraph
        currentChunk = {
          type: DocumentChunkType.PARAGRAPH,
          label: `Párrafo ${chunks.length + 1}`,
          orderIndex: chunks.length,
          startPosition: position,
        };
        currentContent = [trimmed];
      }

      position += block.length + 2;
    }

    // Flush last chunk
    if (currentChunk && currentContent.join('').trim()) {
      chunks.push({
        ...currentChunk as DetectedChunk,
        content: currentContent.join('\n\n').trim(),
        endPosition: position,
      });
    }

    return chunks;
  }

  /** Original line-by-line scan (fallback for single-spacing documents). */
  private detectByLines(text: string): DetectedChunk[] {
    const chunks: DetectedChunk[] = [];
    const lines = text.split('\n');

    let currentChunk: Partial<DetectedChunk> | null = null;
    let currentContent: string[] = [];
    let linePosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        if (currentChunk) currentContent.push('');
        linePosition += 1;
        continue;
      }

      const detected = this.detectLineType(line);

      if (detected) {
        if (currentChunk) {
          chunks.push({
            ...currentChunk as DetectedChunk,
            content: currentContent.join('\n').trim(),
            endPosition: linePosition,
          });
        }
        currentChunk = {
          type: detected.type,
          label: detected.label,
          orderIndex: chunks.length,
          startPosition: linePosition,
        };
        currentContent = [detected.remainingContent];
      } else if (currentChunk) {
        currentContent.push(line);
      } else {
        if (line.length > 0) {
          currentChunk = {
            type: DocumentChunkType.PARAGRAPH,
            label: `Párrafo ${chunks.length + 1}`,
            orderIndex: chunks.length,
            startPosition: linePosition,
          };
          currentContent = [line];
        }
      }

      linePosition += line.length + 1;
    }

    if (currentChunk && currentContent.length > 0) {
      chunks.push({
        ...currentChunk as DetectedChunk,
        content: currentContent.join('\n').trim(),
        endPosition: linePosition,
      });
    }

    return chunks;
  }

  /**
   * Detect the structural type and label of a single line/block header.
   * Returns null if the line is plain content (not a structural marker).
   */
  private detectLineType(line: string): {
    type: DocumentChunkType;
    label: string;
    remainingContent: string;
  } | null {
    // Article: "ARTÍCULO 5", "Art. 3", "Artículo 12A"
    let match = line.match(this.patterns.article);
    if (match) {
      return {
        type: DocumentChunkType.ARTICLE,
        label: `Artículo ${match[2].toUpperCase()}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Chapter: "CAPÍTULO III"
    match = line.match(this.patterns.chapter);
    if (match) {
      return {
        type: DocumentChunkType.CHAPTER,
        label: `Capítulo ${match[2].toUpperCase()}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Section: "SECCIÓN 2", "Sección Primera"
    match = line.match(this.patterns.section);
    if (match) {
      return {
        type: DocumentChunkType.SECTION,
        label: `Sección ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Transitorio / Disposición Transitoria
    match = line.match(this.patterns.transitorio);
    if (match) {
      const num = match[2] ? ` ${match[2]}` : '';
      return {
        type: DocumentChunkType.SECTION,
        label: `Transitorio${num}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Exposición de Motivos
    match = line.match(this.patterns.exposicion);
    if (match) {
      return {
        type: DocumentChunkType.SECTION,
        label: 'Exposición de Motivos',
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Por Cuanto (Whereas)
    match = line.match(this.patterns.porCuanto);
    if (match) {
      return {
        type: DocumentChunkType.PARAGRAPH,
        label: 'Por Cuanto',
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Resuélvase / Be It Resolved
    match = line.match(this.patterns.resuelva);
    if (match) {
      return {
        type: DocumentChunkType.SECTION,
        label: 'Resuélvase',
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Enmienda
    match = line.match(this.patterns.enmienda);
    if (match) {
      return {
        type: DocumentChunkType.SECTION,
        label: `Enmienda: ${line.trim()}`,
        remainingContent: '',
      };
    }

    // Inciso: "Inciso (a)", "INCISO 1."
    match = line.match(this.patterns.inciso);
    if (match) {
      return {
        type: DocumentChunkType.PARAGRAPH,
        label: `Inciso ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Literal: "Literal A"
    match = line.match(this.patterns.literal);
    if (match) {
      return {
        type: DocumentChunkType.PARAGRAPH,
        label: `Literal ${match[2].toUpperCase()}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Paragraph keyword: "PÁRRAFO 1", "Párrafo primero"
    match = line.match(this.patterns.paragraph);
    if (match) {
      return {
        type: DocumentChunkType.PARAGRAPH,
        label: `Párrafo ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Numeral: "1. Texto largo..." or "(1) Texto largo..." — only for lines with real content
    match = line.match(this.patterns.numeral);
    if (match && line.length >= 20) {
      const num = match[1].replace(/[\(\)\.\)]/g, '').trim();
      return {
        type: DocumentChunkType.PARAGRAPH,
        label: `Numeral ${num}`,
        remainingContent: line.substring(match[0].length - match[2].length).trim(),
      };
    }

    // ALLCAPS heuristic: 3+ words all-uppercase with no numbers = heading/title
    // e.g. "DEFINICIONES GENERALES", "DISPOSICIONES FINALES"
    if (this.isAllCapsHeading(line)) {
      return {
        type: DocumentChunkType.SECTION,
        label: this.toTitleCase(line.trim()),
        remainingContent: '',
      };
    }

    return null;
  }

  /**
   * Heuristic: a line is an ALLCAPS heading if it is:
   * - All uppercase (after stripping accents)
   * - 2–8 words long
   * - No digits
   * - Shorter than 80 characters
   */
  private isAllCapsHeading(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length < 4 || trimmed.length > 80) return false;
    const words = trimmed.split(/\s+/);
    if (words.length < 2 || words.length > 8) return false;
    if (/\d/.test(trimmed)) return false;
    // Check every word is uppercase letters (including accented)
    return words.every((w) => /^[A-ZÁÉÍÓÚÜÑ\u00C0-\u024F]+$/u.test(w));
  }

  /** Convert UPPER CASE string to Title Case */
  private toTitleCase(text: string): string {
    const stopWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'a', 'en', 'por', 'para', 'con']);
    return text
      .toLowerCase()
      .split(' ')
      .map((word, i) => (i === 0 || !stopWords.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
      .join(' ');
  }

  /**
   * Validate that detected chunks are reasonable
   * @param chunks Array of detected chunks
   * @returns Validation result with issues
   */
  validateStructure(chunks: DetectedChunk[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (chunks.length === 0) {
      issues.push('No structural elements detected');
    }

    // Check for empty content
    const emptyChunks = chunks.filter((c) => !c.content || c.content.trim().length === 0);
    if (emptyChunks.length > 0) {
      issues.push(`${emptyChunks.length} chunks have empty content`);
    }

    // Check for very short content (likely errors)
    const shortChunks = chunks.filter((c) => c.content && c.content.length < 10);
    if (shortChunks.length > chunks.length * 0.5) {
      issues.push('More than 50% of chunks have suspiciously short content');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
