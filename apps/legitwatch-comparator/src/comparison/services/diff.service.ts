import { Injectable, Logger } from '@nestjs/common';
import DiffMatchPatch = require('diff-match-patch');
import * as Diff from 'diff';
import { html as diff2htmlHtml } from 'diff2html';

export interface DiffResult {
  htmlDiff: string;
  addedChars: number;
  deletedChars: number;
  unchangedChars: number;
  changePercentage: number;
}

export interface LineDiffStats {
  linesAdded: number;
  linesDeleted: number;
  linesUnchanged: number;
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
   * Analyze line-level diff statistics between two texts
   * Returns count of added, deleted, and unchanged lines
   */
  analyzeLineDiff(
    textA: string,
    textB: string,
  ): { linesAdded: number; linesDeleted: number; linesUnchanged: number } {
    // Use diff-match-patch linesToChars encoding for line-level diffing
    const a = (this.dmp as any).diff_linesToChars_(textA, textB);
    const diffs = this.dmp.diff_main(a.chars1, a.chars2, false);
    (this.dmp as any).diff_charsToLines_(diffs, a.lineArray);

    let linesAdded = 0;
    let linesDeleted = 0;
    let linesUnchanged = 0;

    for (const [op, text] of diffs) {
      const lineCount = (text as string)
        .split('\n')
        .filter((l: string) => l.length > 0).length;
      if (op === DiffMatchPatch.DIFF_INSERT) linesAdded += lineCount;
      else if (op === DiffMatchPatch.DIFF_DELETE) linesDeleted += lineCount;
      else linesUnchanged += lineCount;
    }

    return { linesAdded, linesDeleted, linesUnchanged };
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
   * Generate unified diff HTML using `diff` + `diff2html` (line-level).
   * This produces a block-based diff view similar to GitHub's file diffs.
   */
  generateDiffHtml(textA: string, textB: string): string {
    const patch = Diff.createTwoFilesPatch(
      'Documento A',
      'Documento B',
      textA,
      textB,
      '',
      '',
      { context: 3 },
    );

    return diff2htmlHtml(patch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'line-by-line',
    });
  }

  /**
   * Analyze line-level diff statistics between two texts using `diff`.
   * Returns count of added, deleted and unchanged lines.
   */
  analyzeDiff(textA: string, textB: string): LineDiffStats {
    const changes = Diff.diffLines(textA, textB);
    let linesAdded = 0;
    let linesDeleted = 0;
    let linesUnchanged = 0;

    for (const part of changes) {
      const count = part.count ?? 0;
      if (part.added) linesAdded += count;
      else if (part.removed) linesDeleted += count;
      else linesUnchanged += count;
    }

    return { linesAdded, linesDeleted, linesUnchanged };
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
