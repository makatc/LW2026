import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SCRAPER_CONFIG } from './fiscal-intelligence.constants';

export interface FiscalNoteDto {
  bill_number: string | null;
  source_agency: string;
  source_url: string;
  document_url: string | null;
  title: string;
  published_at: Date | null;
  raw_content: string | null;
}

export abstract class BaseAgencyScraper<T = FiscalNoteDto> {
  protected readonly logger: Logger;
  protected readonly http: AxiosInstance;

  constructor(agencyName: string) {
    this.logger = new Logger(agencyName);
    this.http = axios.create({
      timeout: SCRAPER_CONFIG.TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LegalWatch/1.0; +https://legalwatch.pr)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-PR,es;q=0.9,en;q=0.8',
      },
    });
  }

  abstract scrape(): Promise<T[]>;

  protected async fetchWithRetry(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= SCRAPER_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const res = await this.http.get(url, { responseType: 'text' });
        return res.data as string;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Request to ${url} failed (attempt ${attempt}/${SCRAPER_CONFIG.MAX_RETRIES}): ${lastError.message}`
        );
        if (attempt < SCRAPER_CONFIG.MAX_RETRIES) {
          await new Promise(r => setTimeout(r, SCRAPER_CONFIG.RETRY_BACKOFF_BASE_MS * attempt));
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url} after ${SCRAPER_CONFIG.MAX_RETRIES} attempts`);
  }

  protected extractBillNumber(text: string): string | null {
    const pattern = /(?:P\.?\s*de\s*la\s*[CS]\.?|P\.?\s*del?\s*[CS]\.?|R\.?[CS]\.?|R\.?\s*de\s*la\s*[CS]\.?|R\.?\s*del?\s*[CS]\.?)\s*(\d+)/i;
    const match = pattern.exec(text);
    if (!match) return null;
    // Normalize: remove extra spaces
    return match[0].replace(/\s+/g, ' ').trim();
  }
}
