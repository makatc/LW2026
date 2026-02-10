import { Injectable, Logger } from '@nestjs/common';

export interface NormalizationStats {
  originalLength: number;
  normalizedLength: number;
  removedLines: number;
  removedCharacters: number;
}

/**
 * NormalizerService
 * Cleans legal document text by removing noise such as:
 * - Headers and footers
 * - Page numbers
 * - Line numbers
 * - Excessive whitespace
 * - Common artifacts from PDF extraction
 */
@Injectable()
export class NormalizerService {
  private readonly logger = new Logger(NormalizerService.name);

  /**
   * Normalize legal document text
   * @param text Raw text from document
   * @returns Normalized text with statistics
   */
  normalize(text: string): { normalizedText: string; stats: NormalizationStats } {
    if (!text || text.trim().length === 0) {
      return {
        normalizedText: '',
        stats: {
          originalLength: 0,
          normalizedLength: 0,
          removedLines: 0,
          removedCharacters: 0,
        },
      };
    }

    const originalLength = text.length;
    const originalLines = text.split('\n').length;

    let normalized = text;

    // Step 1: Remove common header/footer patterns
    normalized = this.removeHeadersFooters(normalized);

    // Step 2: Remove page numbers
    normalized = this.removePageNumbers(normalized);

    // Step 3: Remove line numbers (often from legal documents)
    normalized = this.removeLineNumbers(normalized);

    // Step 4: Clean up whitespace
    normalized = this.cleanWhitespace(normalized);

    // Step 5: Remove PDF artifacts
    normalized = this.removePdfArtifacts(normalized);

    const normalizedLength = normalized.length;
    const normalizedLines = normalized.split('\n').length;

    const stats: NormalizationStats = {
      originalLength,
      normalizedLength,
      removedLines: originalLines - normalizedLines,
      removedCharacters: originalLength - normalizedLength,
    };

    this.logger.log(
      `Normalized text: ${stats.originalLength} → ${stats.normalizedLength} chars (${stats.removedCharacters} removed)`,
    );

    return { normalizedText: normalized, stats };
  }

  /**
   * Remove common header and footer patterns
   */
  private removeHeadersFooters(text: string): string {
    const lines = text.split('\n');
    const filtered: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      // Skip headers/footers with common patterns
      if (
        trimmed.includes('página') ||
        trimmed.includes('page') ||
        /^p[aá]gina\s+\d+/i.test(trimmed) ||
        /^\d+\s+de\s+\d+$/i.test(trimmed) ||
        trimmed.match(/^(gaceta|diario|bolet[ií]n)\s+(oficial|o\.)/i) ||
        trimmed.match(/^(imprenta|publicado|copyright)/i)
      ) {
        continue;
      }

      filtered.push(line);
    }

    return filtered.join('\n');
  }

  /**
   * Remove standalone page numbers
   */
  private removePageNumbers(text: string): string {
    // Remove lines that are just numbers (page numbers)
    return text.replace(/^\s*\d+\s*$/gm, '');
  }

  /**
   * Remove line numbers from beginning of lines
   * Common in legal documents: "1. ", "01. ", etc.
   */
  private removeLineNumbers(text: string): string {
    // Remove leading line numbers like "1. " or "01. " but keep Article numbers
    const lines = text.split('\n');
    const cleaned = lines.map((line) => {
      // Don't remove if it's an Article/Chapter/Section marker
      if (/^(art[íi]culo|cap[íi]tulo|secci[óo]n|p[áa]rrafo)/i.test(line.trim())) {
        return line;
      }

      // Remove simple line numbers at start
      return line.replace(/^\s*\d{1,3}\.\s+/, '');
    });

    return cleaned.join('\n');
  }

  /**
   * Clean up excessive whitespace
   */
  private cleanWhitespace(text: string): string {
    // Replace multiple spaces with single space
    let cleaned = text.replace(/ {2,}/g, ' ');

    // Replace more than 2 consecutive newlines with 2
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    const lines = cleaned.split('\n').map((line) => line.trim());

    return lines.join('\n').trim();
  }

  /**
   * Remove common PDF extraction artifacts
   */
  private removePdfArtifacts(text: string): string {
    let cleaned = text;

    // Remove soft hyphens and zero-width characters
    cleaned = cleaned.replace(/\u00AD/g, ''); // Soft hyphen
    cleaned = cleaned.replace(/\u200B/g, ''); // Zero-width space
    cleaned = cleaned.replace(/\u200C/g, ''); // Zero-width non-joiner
    cleaned = cleaned.replace(/\u200D/g, ''); // Zero-width joiner

    // Fix broken words across lines (hyphenation)
    // Example: "constitu-\ncional" → "constitucional"
    cleaned = cleaned.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');

    // Remove form feed characters
    cleaned = cleaned.replace(/\f/g, '\n');

    return cleaned;
  }

  /**
   * Quick validation to ensure normalization didn't destroy content
   */
  validateNormalization(original: string, normalized: string): boolean {
    // If normalized is less than 50% of original, something went wrong
    if (normalized.length < original.length * 0.5) {
      this.logger.warn(
        'Normalization removed more than 50% of content - possible issue',
      );
      return false;
    }

    // Check that we still have some substantial content
    if (normalized.trim().length < 100) {
      this.logger.warn('Normalized text is too short');
      return false;
    }

    return true;
  }
}
