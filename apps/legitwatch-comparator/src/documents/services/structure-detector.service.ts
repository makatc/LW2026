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
 */
@Injectable()
export class StructureDetectorService {
  private readonly logger = new Logger(StructureDetectorService.name);

  // Regex patterns for Spanish legal documents
  private readonly patterns = {
    // Matches: "ARTÍCULO 1", "Artículo 2", "Art. 3", "ARTICULO 4"
    article: /^(ART[ÍI]CULO|Art\.|ARTICULO)\s+(\d+[A-Z]?)\b\.?\s*[-–—]?\s*/im,

    // Matches: "CAPÍTULO I", "Capítulo II", "CAPITULO III"
    chapter: /^(CAP[ÍI]TULO|CAPITULO)\s+([IVX]+|\d+)\b\.?\s*[-–—]?\s*/im,

    // Matches: "SECCIÓN 1", "Sección Primera", "SECCION I"
    section: /^(SECCI[ÓO]N|SECCION)\s+([IVX]+|\d+|Primera|Segunda|Tercera)\b\.?\s*[-–—]?\s*/im,

    // Matches: "PÁRRAFO 1", "Párrafo primero", "PARAGRAFO I"
    paragraph: /^(P[ÁA]RRAFO|PARAGRAFO|PAR[ÁA]GRAFO)\s+([IVX]+|\d+|primero|segundo)\b\.?\s*[-–—]?\s*/im,
  };

  /**
   * Detect and extract structural chunks from legal text
   * @param text Raw legal document text
   * @returns Array of detected chunks with metadata
   */
  detectStructure(text: string): DetectedChunk[] {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided to structure detector');
      return [];
    }

    const chunks: DetectedChunk[] = [];
    const lines = text.split('\n');

    let currentChunk: Partial<DetectedChunk> | null = null;
    let currentContent: string[] = [];
    let linePosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        // Empty line - add to current content if exists
        if (currentChunk) {
          currentContent.push('');
        }
        linePosition += 1;
        continue;
      }

      // Try to match structural markers
      const detected = this.detectLineType(line);

      if (detected) {
        // Save previous chunk if exists
        if (currentChunk) {
          chunks.push({
            ...currentChunk as DetectedChunk,
            content: currentContent.join('\n').trim(),
            endPosition: linePosition,
          });
        }

        // Start new chunk
        currentChunk = {
          type: detected.type,
          label: detected.label,
          orderIndex: chunks.length,
          startPosition: linePosition,
        };
        currentContent = [detected.remainingContent];
      } else if (currentChunk) {
        // Add to current chunk content
        currentContent.push(line);
      } else {
        // No current chunk - treat as paragraph
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

    // Save last chunk
    if (currentChunk && currentContent.length > 0) {
      chunks.push({
        ...currentChunk as DetectedChunk,
        content: currentContent.join('\n').trim(),
        endPosition: linePosition,
      });
    }

    this.logger.log(`Detected ${chunks.length} structural chunks`);
    return chunks;
  }

  /**
   * Detect the type and label of a line
   * @param line Single line of text
   * @returns Detection result or null
   */
  private detectLineType(line: string): {
    type: DocumentChunkType;
    label: string;
    remainingContent: string;
  } | null {
    // Try Article
    let match = line.match(this.patterns.article);
    if (match) {
      return {
        type: DocumentChunkType.ARTICLE,
        label: `Artículo ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Try Chapter
    match = line.match(this.patterns.chapter);
    if (match) {
      return {
        type: DocumentChunkType.CHAPTER,
        label: `Capítulo ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Try Section
    match = line.match(this.patterns.section);
    if (match) {
      return {
        type: DocumentChunkType.SECTION,
        label: `Sección ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    // Try Paragraph
    match = line.match(this.patterns.paragraph);
    if (match) {
      return {
        type: DocumentChunkType.PARAGRAPH,
        label: `Párrafo ${match[2]}`,
        remainingContent: line.substring(match[0].length).trim(),
      };
    }

    return null;
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
