import { Injectable, Logger } from '@nestjs/common';
import DiffMatchPatch = require('diff-match-patch');

export interface DiffResult {
  htmlDiff: string;
  addedChars: number;
  deletedChars: number;
  unchangedChars: number;
  changePercentage: number;
}

/**
 * DiffService
 * Generates character-level diffs between two text strings
 * Uses Google's diff-match-patch library for accurate diffing
 */
@Injectable()
export class DiffService {
  private readonly logger = new Logger(DiffService.name);
  private readonly dmp: DiffMatchPatch;

  constructor() {
    this.dmp = new DiffMatchPatch();
    // Configure diff-match-patch settings
    this.dmp.Diff_Timeout = 2.0; // 2 second timeout for diff operation
    this.dmp.Diff_EditCost = 4; // Cost of an empty edit operation in terms of edit characters
  }

  /**
   * Generate HTML diff between two text strings
   * @param oldText Original text
   * @param newText New text
   * @returns DiffResult with HTML and statistics
   */
  generateDiff(oldText: string, newText: string): DiffResult {
    this.logger.debug(
      `Generating diff: ${oldText.length} → ${newText.length} chars`,
    );

    // Generate the diff
    const diffs = this.dmp.diff_main(oldText, newText);

    // Clean up semantically - improves readability
    this.dmp.diff_cleanupSemantic(diffs);

    // Generate HTML with <ins> and <del> tags
    const htmlDiff = this.dmp.diff_prettyHtml(diffs);

    // Calculate statistics
    let addedChars = 0;
    let deletedChars = 0;
    let unchangedChars = 0;

    for (const [operation, text] of diffs) {
      const length = text.length;
      if (operation === DiffMatchPatch.DIFF_INSERT) {
        addedChars += length;
      } else if (operation === DiffMatchPatch.DIFF_DELETE) {
        deletedChars += length;
      } else {
        unchangedChars += length;
      }
    }

    const totalChars = Math.max(oldText.length, newText.length) || 1;
    const changePercentage =
      ((addedChars + deletedChars) / totalChars) * 100;

    return {
      htmlDiff: this.cleanupHtml(htmlDiff),
      addedChars,
      deletedChars,
      unchangedChars,
      changePercentage: Math.round(changePercentage * 100) / 100,
    };
  }

  /**
   * Generate a side-by-side diff (returns separate old/new versions with markup)
   * @param oldText Original text
   * @param newText New text
   * @returns Object with separate old and new HTML strings
   */
  generateSideBySideDiff(
    oldText: string,
    newText: string,
  ): { oldHtml: string; newHtml: string } {
    const diffs = this.dmp.diff_main(oldText, newText);
    this.dmp.diff_cleanupSemantic(diffs);

    let oldHtml = '';
    let newHtml = '';

    for (const [operation, text] of diffs) {
      const escapedText = this.escapeHtml(text);

      if (operation === DiffMatchPatch.DIFF_INSERT) {
        // Only appears in new version
        newHtml += `<ins>${escapedText}</ins>`;
      } else if (operation === DiffMatchPatch.DIFF_DELETE) {
        // Only appears in old version
        oldHtml += `<del>${escapedText}</del>`;
      } else {
        // Appears in both
        oldHtml += escapedText;
        newHtml += escapedText;
      }
    }

    return { oldHtml, newHtml };
  }

  /**
   * Check if two strings are similar (above threshold)
   * @param text1 First text
   * @param text2 Second text
   * @param threshold Similarity threshold (0-1), default 0.7
   * @returns True if texts are similar
   */
  areSimilar(text1: string, text2: string, threshold: number = 0.7): boolean {
    if (text1 === text2) return true;
    if (!text1 || !text2) return false;

    const diffs = this.dmp.diff_main(text1, text2);
    const levenshtein = this.dmp.diff_levenshtein(diffs);
    const maxLength = Math.max(text1.length, text2.length);

    if (maxLength === 0) return true;

    const similarity = 1 - levenshtein / maxLength;
    return similarity >= threshold;
  }

  /**
   * Calculate similarity percentage between two strings
   * @param text1 First text
   * @param text2 Second text
   * @returns Similarity percentage (0-100)
   */
  calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 100;
    if (!text1 || !text2) return 0;

    const diffs = this.dmp.diff_main(text1, text2);
    const levenshtein = this.dmp.diff_levenshtein(diffs);
    const maxLength = Math.max(text1.length, text2.length);

    if (maxLength === 0) return 100;

    const similarity = ((1 - levenshtein / maxLength) * 100);
    return Math.round(similarity * 100) / 100;
  }

  /**
   * Cleanup and improve HTML output
   */
  private cleanupHtml(html: string): string {
    // Replace &para; (¶) with nothing - it's added by diff-match-patch for line breaks
    let cleaned = html.replace(/&para;/g, '');

    // Ensure proper spacing
    cleaned = cleaned.replace(/><\/span>/g, '> </span>');

    return cleaned.trim();
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
