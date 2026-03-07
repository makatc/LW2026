import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');
import { PdfExtractorService } from './pdf-extractor.service';
import { OcrService } from './ocr.service';

export interface ParsedFile {
  text: string;
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    pageCount?: number;
    wordCount: number;
  };
}

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);
  private readonly geminiApiKey: string | undefined;
  private readonly geminiOcrTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly ocrService: OcrService,
  ) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.geminiOcrTimeoutMs = parseInt(
      this.configService.get<string>('GEMINI_OCR_TIMEOUT_MS') ?? '60000',
      10,
    );
  }

  /**
   * Parse uploaded file based on mime type
   */
  async parseFile(file: Express.Multer.File): Promise<ParsedFile> {
    this.logger.log(
      `Parsing file: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );

    let text: string;
    let metadata: Partial<ParsedFile['metadata']> = {};

    try {
      switch (file.mimetype) {
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          ({ text, metadata } = await this.parseWord(file));
          break;

        case 'application/pdf':
          ({ text, metadata } = await this.parsePdf(file));
          break;

        case 'text/plain':
          text = file.buffer.toString('utf-8');
          metadata = {};
          break;

        default:
          throw new BadRequestException(
            `Unsupported file type: ${file.mimetype}. Supported types: .docx, .doc, .pdf, .txt`,
          );
      }

      const wordCount = this.countWords(text);

      return {
        text,
        metadata: {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          wordCount,
          ...metadata,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to parse file ${file.originalname}:`, error);
      throw new BadRequestException(
        `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse Word document (.doc, .docx)
   */
  private async parseWord(
    file: Express.Multer.File,
  ): Promise<{ text: string; metadata: Partial<ParsedFile['metadata']> }> {
    this.logger.debug(`Parsing Word document: ${file.originalname}`);

    const result = await mammoth.extractRawText({ buffer: file.buffer });

    if (result.messages && result.messages.length > 0) {
      this.logger.warn(
        `Word parsing warnings for ${file.originalname}:`,
        result.messages,
      );
    }

    return {
      text: result.value,
      metadata: {},
    };
  }

  /**
   * Parse PDF document using a 3-layer extraction cascade:
   *
   * Layer 1 — pdfjs-dist  (handles columns, tables, header/footer filtering)
   * Layer 2 — pdf-parse   (fallback if pdfjs fails)
   * Layer 3 — Gemini OCR  (last resort for scanned PDFs)
   */
  private async parsePdf(
    file: Express.Multer.File,
  ): Promise<{ text: string; metadata: Partial<ParsedFile['metadata']> }> {
    this.logger.debug(`Parsing PDF: ${file.originalname} (${file.size} bytes)`);

    // --- Layer 1: pdfjs-dist ---
    try {
      const result = await this.pdfExtractor.extract(file.buffer);
      const quality = this.assessTextQuality(result.text);

      this.logger.debug(
        `pdfjs layer: ${quality.wordCount} words, quality ${result.qualityScore.toFixed(2)}`,
      );

      if (quality.isUsable) {
        return { text: result.text, metadata: { pageCount: result.pageCount } };
      }

      this.logger.debug(
        `pdfjs quality too low (${result.qualityScore.toFixed(2)}) — trying pdf-parse`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'PDF_ENCRYPTED') {
        throw new BadRequestException(
          'El PDF está protegido con contraseña y no puede procesarse.',
        );
      }
      this.logger.warn(`pdfjs failed for "${file.originalname}": ${msg} — trying pdf-parse`);
    }

    // --- Layer 2: pdf-parse ---
    let pdpText = '';
    let pageCount: number | undefined;
    try {
      const parser = new PDFParse({ data: file.buffer });
      const [textResult, infoResult] = await Promise.all([
        parser.getText(),
        parser.getInfo().catch(() => null),
      ]);
      await parser.destroy();
      pdpText = textResult.text ?? '';
      pageCount = infoResult?.total;

      const quality = this.assessTextQuality(pdpText);
      this.logger.debug(
        `pdf-parse layer: ${quality.wordCount} words, quality ${quality.score.toFixed(2)}`,
      );

      if (quality.isUsable) {
        return { text: pdpText, metadata: { pageCount } };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('encrypt') || msg.includes('password')) {
        throw new BadRequestException(
          'El PDF está protegido con contraseña y no puede procesarse.',
        );
      }
      this.logger.warn(`pdf-parse failed for "${file.originalname}": ${msg}`);
    }

    // --- Layer 3: ocrmypdf + Tesseract (local OCR — free, fast, private) ---
    if (await this.ocrService.isAvailable()) {
      this.logger.log(
        `Local text layers insufficient for "${file.originalname}" — running ocrmypdf`,
      );
      const ocrResult = await this.ocrService.ocrPdf(file.buffer);
      if (ocrResult.success) {
        try {
          const ocrExtracted = await this.pdfExtractor.extract(ocrResult.buffer);
          const ocrQuality = this.assessTextQuality(ocrExtracted.text);
          if (ocrQuality.isUsable) {
            this.logger.log(
              `ocrmypdf extracted ${ocrQuality.wordCount} words from "${file.originalname}"`,
            );
            return { text: ocrExtracted.text, metadata: { pageCount: ocrExtracted.pageCount } };
          }
        } catch {
          this.logger.warn(`pdfjs re-extraction after OCR failed for "${file.originalname}"`);
        }
      }
    }

    // --- Layer 4: Gemini OCR (emergency fallback — cloud, costs tokens) ---
    if (this.geminiApiKey) {
      this.logger.log(
        `All local layers failed for "${file.originalname}" — attempting Gemini OCR`,
      );
      const ocrText = await this.extractTextViaGeminiOcr(file.buffer, file.originalname);
      const ocrQuality = this.assessTextQuality(ocrText);
      if (ocrQuality.isUsable) {
        this.logger.log(
          `Gemini OCR extracted ${ocrText.length} chars (${ocrQuality.wordCount} words) from "${file.originalname}"`,
        );
        return { text: ocrText, metadata: { pageCount } };
      }
    }

    throw new BadRequestException(
      `El PDF "${file.originalname}" no contiene texto extraíble. ` +
      (this.geminiApiKey
        ? 'Es posible que sea un PDF escaneado de baja calidad.'
        : 'Configure GEMINI_API_KEY para habilitar extracción de PDFs escaneados.'),
    );
  }

  /**
   * Assess whether extracted text is usable for legal comparison.
   * Returns a quality score and diagnosis flags.
   */
  private assessTextQuality(text: string): {
    score: number;
    isUsable: boolean;
    wordCount: number;
    printableRatio: number;
  } {
    if (!text || text.length === 0) {
      return { score: 0, isUsable: false, wordCount: 0, printableRatio: 0 };
    }

    const trimmed = text.trim();

    // Ratio of printable ASCII + Latin extended chars vs total
    const printable = (trimmed.match(/[\x20-\x7E\u00A0-\u024F]/g) ?? []).length;
    const printableRatio = printable / trimmed.length;

    // Word count (sequences of 2+ word chars)
    const wordCount = (trimmed.match(/\b\w{2,}\b/g) ?? []).length;

    // Average word length — garbage text tends to have very short or very long tokens
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    const avgWordLen = words.length > 0
      ? words.reduce((s, w) => s + w.length, 0) / words.length
      : 0;
    const wordLenOk = avgWordLen >= 3 && avgWordLen <= 12;

    // Detect garbage patterns: lines with only special chars, repetitive symbols
    const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
    const garbageLines = lines.filter((l) => /^[^a-zA-Z\u00C0-\u024F]{0,3}$/.test(l.trim()));
    const garbageRatio = lines.length > 0 ? garbageLines.length / lines.length : 1;

    // Composite score (0–1)
    const score =
      (printableRatio * 0.4) +
      (wordCount >= 20 ? 0.3 : (wordCount / 20) * 0.3) +
      (wordLenOk ? 0.2 : 0) +
      ((1 - garbageRatio) * 0.1);

    // Usable if: score >= 0.5 AND at least 15 words AND printable ratio >= 0.6
    const isUsable = score >= 0.5 && wordCount >= 15 && printableRatio >= 0.6;

    return { score, isUsable, wordCount, printableRatio };
  }

  /**
   * Use Google Gemini API to extract text from a scanned/image PDF.
   * Gemini supports PDFs via inline base64 data in the multimodal API.
   */
  private async extractTextViaGeminiOcr(
    buffer: Buffer,
    fileName: string,
  ): Promise<string> {
    try {
      const base64Pdf = buffer.toString('base64');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;

      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'application/pdf',
                    data: base64Pdf,
                  },
                },
                {
                  text: 'Extrae y transcribe todo el texto de este documento PDF exactamente como aparece. Preserva la estructura de párrafos y artículos. No añadas comentarios ni explicaciones, solo el texto del documento.',
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0,
          },
        },
        {
          headers: { 'content-type': 'application/json' },
          timeout: this.geminiOcrTimeoutMs,
        },
      );

      const extracted =
        (response.data as any).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.log(
        `Gemini OCR extracted ${extracted.length} chars from "${fileName}"`,
      );
      return extracted;
    } catch (error) {
      this.logger.error(
        `Gemini OCR failed for "${fileName}": ${(error as any)?.message}`,
      );
      return '';
    }
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Validate file size (max 10MB)
   */
  validateFileSize(file: Express.Multer.File, maxSizeMB = 10): void {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File too large. Maximum size: ${maxSizeMB}MB`,
      );
    }
  }

  /**
   * Validate file type
   */
  validateFileType(file: Express.Multer.File): void {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/pdf', // .pdf
      'text/plain', // .txt
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: .docx, .doc, .pdf, .txt`,
      );
    }
  }
}
