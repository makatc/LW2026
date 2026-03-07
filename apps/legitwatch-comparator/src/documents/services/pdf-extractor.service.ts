import { Injectable, Logger } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

export interface PdfExtractResult {
  text: string;
  pageCount: number;
  /** Quality score 0–1: ≥0.7 = good, 0.3–0.7 = partial, <0.3 = likely scanned */
  qualityScore: number;
  hasTextLayer: boolean;
}

/**
 * PdfExtractorService
 * Uses pdfjs-dist (Mozilla PDF.js) for reliable text extraction from native PDFs.
 * Handles multi-column layouts, embedded fonts, and header/footer filtering better
 * than pdf-parse which wraps an older version of the same library.
 */
@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);

  async extract(buffer: Buffer): Promise<PdfExtractResult> {
    const uint8Array = new Uint8Array(buffer);

    let pdf: any;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        // Suppress worker (Node.js has no worker thread by default in pdfjs v3)
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableFontFace: true,
        // Suppress canvas warnings
        verbosity: 0,
      });
      pdf = await loadingTask.promise;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('encrypt') || msg.includes('password')) {
        throw new Error('PDF_ENCRYPTED');
      }
      throw new Error(`PDF_LOAD_FAILED: ${msg}`);
    }

    const pageCount: number = pdf.numPages;
    const pageTexts: string[] = [];
    // Track Y positions of repeated text to detect headers/footers
    const repeatedLineTracker = new Map<string, number>();

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Group items by approximate Y position (same line = within 2px)
      const lines = new Map<number, string[]>();
      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        const str = (item as any).str as string;
        if (!str.trim()) continue;

        const y = Math.round((item as any).transform?.[5] ?? 0);
        const roundedY = Math.round(y / 2) * 2; // bucket to 2px grid
        if (!lines.has(roundedY)) lines.set(roundedY, []);
        lines.get(roundedY)!.push(str);
      }

      // Build sorted lines (top to bottom = descending Y in PDF coords)
      const sortedYs = [...lines.keys()].sort((a, b) => b - a);
      const pageLines: string[] = sortedYs.map((y) =>
        lines.get(y)!.join(' ').trim(),
      );

      // Track text that appears on every page (likely header/footer)
      for (const line of pageLines) {
        if (line.length < 4) continue;
        repeatedLineTracker.set(line, (repeatedLineTracker.get(line) ?? 0) + 1);
      }

      pageTexts.push(pageLines.join('\n'));
    }

    // Build header/footer blocklist (text appearing on ≥80% of pages)
    const headerFooterThreshold = Math.max(2, Math.round(pageCount * 0.8));
    const headerFooter = new Set<string>();
    for (const [text, count] of repeatedLineTracker) {
      if (count >= headerFooterThreshold) {
        headerFooter.add(text);
      }
    }

    if (headerFooter.size > 0) {
      this.logger.debug(
        `Filtered ${headerFooter.size} repeated header/footer lines`,
      );
    }

    // Reconstruct final text, removing header/footer lines
    const filteredPages = pageTexts.map((pageText) => {
      const lines = pageText.split('\n');
      return lines.filter((l) => !headerFooter.has(l.trim())).join('\n');
    });

    const fullText = filteredPages.join('\n\n').trim();

    // Compute quality metrics
    const wordCount = (fullText.match(/\b\w{2,}\b/g) ?? []).length;
    const printable = (fullText.match(/[\x20-\x7E\u00A0-\u024F]/g) ?? []).length;
    const printableRatio = fullText.length > 0 ? printable / fullText.length : 0;
    const hasTextLayer = wordCount > 5;

    // Quality score (same formula as FileParserService.assessTextQuality)
    const wordScore = Math.min(1, wordCount / 50);
    const qualityScore =
      printableRatio * 0.4 +
      wordScore * 0.4 +
      (printableRatio >= 0.6 ? 0.2 : 0);

    this.logger.debug(
      `pdfjs extracted ${wordCount} words across ${pageCount} pages, quality: ${qualityScore.toFixed(2)}`,
    );

    return { text: fullText, pageCount, qualityScore, hasTextLayer };
  }
}
