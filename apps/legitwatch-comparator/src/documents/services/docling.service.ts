import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface DoclingChunk {
  label: string;
  type: 'article' | 'chapter' | 'section' | 'paragraph';
  content: string;
  level: number;
  orderIndex: number;
}

export interface DoclingResult {
  chunks: DoclingChunk[];
  metadata: {
    pageCount?: number;
    title?: string;
    fileType: string;
    chunkCount: number;
  };
  rawText: string;
}

/**
 * DoclingService
 * Optional NestJS client for the Docling Worker (Python FastAPI microservice).
 * Provides superior document structure extraction for complex PDFs/DOCX.
 *
 * Enable with DOCLING_ENABLED=true in .env.
 * The worker must be running at DOCLING_URL (default: http://127.0.0.1:8099).
 *
 * Degrades gracefully — returns null if worker is unavailable or disabled.
 */
@Injectable()
export class DoclingService {
  private readonly logger = new Logger(DoclingService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private _available: boolean | null = null;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      this.configService.get<string>('DOCLING_ENABLED')?.toLowerCase() === 'true';
    this.baseUrl =
      this.configService.get<string>('DOCLING_URL') ?? 'http://127.0.0.1:8099';
    this.timeoutMs = parseInt(
      this.configService.get<string>('DOCLING_TIMEOUT_MS') ?? '120000',
      10,
    );

    if (this.enabled) {
      this.logger.log(`Docling enabled — worker at ${this.baseUrl}`);
    } else {
      this.logger.debug('Docling disabled (set DOCLING_ENABLED=true to enable)');
    }
  }

  /**
   * Check if the Docling worker is reachable.
   * Result cached after first successful call.
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;
    if (this._available !== null) return this._available;

    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 3000 });
      if (res.data?.status === 'ok') {
        this.logger.log(
          `Docling worker ready (v${res.data.docling_version ?? '?'})`,
        );
        this._available = true;
      } else {
        this._available = false;
      }
    } catch {
      this._available = false;
      this.logger.warn(
        `Docling worker not reachable at ${this.baseUrl} — falling back to local pipeline`,
      );
    }

    return this._available;
  }

  /** Reset availability cache (e.g. after worker restart). */
  resetAvailabilityCache(): void {
    this._available = null;
  }

  /**
   * Parse a file using the Docling worker.
   * Returns null if the worker is unavailable or parsing fails.
   *
   * @param buffer   Raw file bytes
   * @param fileName Original file name (used to detect type)
   */
  async parse(
    buffer: Buffer,
    fileName: string,
  ): Promise<DoclingResult | null> {
    if (!(await this.isAvailable())) return null;

    // Use Node.js 20+ built-in FormData (no extra dependency)
    const form = new globalThis.FormData();
    const blob = new globalThis.Blob([new Uint8Array(buffer)], {
      type: this.getMimeType(fileName),
    });
    form.append('file', blob, fileName);

    try {
      const res = await axios.post<DoclingResult>(
        `${this.baseUrl}/parse`,
        form,
        {
          timeout: this.timeoutMs,
          maxContentLength: 50 * 1024 * 1024, // 50MB
        },
      );

      const result = res.data;
      if (!result?.chunks || !Array.isArray(result.chunks)) {
        this.logger.warn('Docling response missing chunks array');
        return null;
      }

      this.logger.log(
        `Docling parsed "${fileName}": ${result.chunks.length} chunks, ${result.metadata?.pageCount ?? '?'} pages`,
      );

      return result;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      const msg = axiosErr.message ?? String(err);

      // Mark unavailable if server error (not a parsing error)
      if (!status || status >= 500) {
        this.logger.error(`Docling worker error (${status ?? 'no response'}): ${msg}`);
        this._available = false;
      } else {
        this.logger.warn(`Docling parse failed for "${fileName}" (${status}): ${msg}`);
      }

      return null;
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc': return 'application/msword';
      default: return 'application/octet-stream';
    }
  }
}
