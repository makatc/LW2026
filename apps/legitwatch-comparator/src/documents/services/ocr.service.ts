import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface OcrResult {
  buffer: Buffer;
  /** true if OCR text layer was successfully added */
  success: boolean;
  message?: string;
}

/**
 * OcrService
 * Wraps the ocrmypdf CLI to add a searchable text layer to scanned PDFs.
 * ocrmypdf uses Tesseract under the hood and produces a PDF with embedded text,
 * which can then be re-parsed by PdfExtractorService.
 *
 * Falls back gracefully if ocrmypdf is not installed.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly timeoutMs: number;
  private _available: boolean | null = null;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = parseInt(
      this.configService.get<string>('OCR_TIMEOUT_MS') ?? '120000',
      10,
    );
  }

  /**
   * Check if ocrmypdf is installed and available.
   * Result is cached after first call.
   */
  async isAvailable(): Promise<boolean> {
    if (this._available !== null) return this._available;

    try {
      await this.runCommand('ocrmypdf', ['--version'], 5000);
      this._available = true;
      this.logger.log('ocrmypdf is available');
    } catch {
      this._available = false;
      this.logger.warn(
        'ocrmypdf not found — local OCR disabled. Install with: sudo apt-get install -y ocrmypdf tesseract-ocr tesseract-ocr-spa',
      );
    }

    return this._available;
  }

  /**
   * Run OCR on a PDF buffer and return a new PDF buffer with a text layer.
   *
   * @param inputBuffer  Original PDF (scanned or native)
   * @param language     Tesseract language code (default: 'spa+eng')
   * @returns OcrResult with processed PDF buffer
   */
  async ocrPdf(
    inputBuffer: Buffer,
    language = 'spa+eng',
  ): Promise<OcrResult> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        buffer: inputBuffer,
        success: false,
        message: 'ocrmypdf not installed',
      };
    }

    const tmpDir = await mkdtemp(join(tmpdir(), 'lwocr-'));
    const inputPath = join(tmpDir, 'input.pdf');
    const outputPath = join(tmpDir, 'output.pdf');

    try {
      await writeFile(inputPath, inputBuffer);

      await this.runCommand('ocrmypdf', [
        '--language', language,
        '--pdf-renderer', 'sandwich',  // preserves original layout, adds invisible text layer
        '--output-type', 'pdf',
        '--skip-text',                 // don't re-OCR pages that already have text
        '--rotate-pages',              // auto-rotate if page is sideways
        '--deskew',                    // correct slight rotation
        '--optimize', '1',             // light compression
        '--quiet',
        inputPath,
        outputPath,
      ], this.timeoutMs);

      const resultBuffer = await readFile(outputPath);
      this.logger.log(
        `OCR complete: ${inputBuffer.length} → ${resultBuffer.length} bytes`,
      );

      return { buffer: resultBuffer, success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`ocrmypdf failed: ${msg}`);
      return { buffer: inputBuffer, success: false, message: msg };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Run a shell command and return its stdout.
   * Rejects on non-zero exit code or timeout.
   */
  private runCommand(
    cmd: string,
    args: string[],
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')}`));
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          // ocrmypdf exit code 6 = already has text (--skip-text should prevent this, but handle gracefully)
          if (code === 6) {
            resolve(stdout);
          } else {
            reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(0, 300)}`));
          }
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
