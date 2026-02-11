import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as mammoth from 'mammoth';
const pdfParse = require('pdf-parse');

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

    const data = await pdfParse(file.buffer);

    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
      },
    };
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
