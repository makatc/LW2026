import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

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

  constructor(private readonly configService: ConfigService) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
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
   * Parse PDF document
   */
  private async parsePdf(
    file: Express.Multer.File,
  ): Promise<{ text: string; metadata: Partial<ParsedFile['metadata']> }> {
    this.logger.debug(`Parsing PDF document: ${file.originalname}`);

    let text: string;
    let pageCount: number | undefined;
    try {
      const parser = new PDFParse({ data: file.buffer });
      const [textResult, infoResult] = await Promise.all([
        parser.getText(),
        parser.getInfo().catch(() => null),
      ]);
      await parser.destroy();
      text = textResult.text ?? '';
      pageCount = infoResult?.total;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('encrypt') || msg.includes('password')) {
        throw new BadRequestException(
          `El PDF está protegido con contraseña y no puede procesarse.`,
        );
      }
      throw new BadRequestException(
        `No se pudo leer el PDF "${file.originalname}". Asegúrate de que no esté dañado ni sea solo una imagen escaneada. Detalle: ${msg}`,
      );
    }

    // PDF with no extractable text — try AI-powered OCR fallback
    if (!text || text.trim().length < 10) {
      if (this.geminiApiKey) {
        this.logger.log(
          `PDF "${file.originalname}" has no text layer — attempting Gemini OCR`,
        );
        const ocrText = await this.extractTextViaGeminiOcr(file.buffer, file.originalname);
        if (ocrText && ocrText.trim().length >= 10) {
          return { text: ocrText, metadata: { pageCount } };
        }
      }
      throw new BadRequestException(
        `El PDF "${file.originalname}" no contiene texto extraíble. Es posible que sea un PDF escaneado. ` +
        (this.geminiApiKey
          ? 'El OCR automático no pudo extraer texto suficiente.'
          : 'Configure GEMINI_API_KEY para habilitar extracción automática de PDFs escaneados.'),
      );
    }

    return {
      text,
      metadata: { pageCount },
    };
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
          timeout: 60000,
        },
      );

      const extracted =
        (response.data as any).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.log(
        `Gemini OCR extracted ${extracted.length} characters from "${fileName}"`,
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
