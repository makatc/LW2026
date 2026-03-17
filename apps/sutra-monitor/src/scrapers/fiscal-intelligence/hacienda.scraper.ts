// FUENTE: https://hacienda.pr.gov/sala-de-prensa/memoriales-y-ponencias-legislativas
// Verificado: 2026-03-17
// Hacienda publica memoriales organizados por número de proyecto de ley.
// Patrón del número de proyecto: "P. de la C. NNN" o "P. del S. NNN"
// Selector: lista de enlaces de documentos con metadatos de fecha y título

import * as cheerio from 'cheerio';
import { Injectable } from '@nestjs/common';
import { BaseAgencyScraper, FiscalNoteDto } from './base-agency.scraper';
import { FISCAL_SOURCES, AGENCY_NAMES } from './fiscal-intelligence.constants';
import { DatabaseService } from '../../modules/database/database.service';

@Injectable()
export class HaciendaScraper extends BaseAgencyScraper {
  constructor(private readonly db: DatabaseService) {
    super('HaciendaScraper');
  }

  async scrape(): Promise<FiscalNoteDto[]> {
    this.logger.log('Starting Hacienda scrape...');
    const results: FiscalNoteDto[] = [];

    try {
      const url = `${FISCAL_SOURCES.HACIENDA_BASE_URL}${FISCAL_SOURCES.HACIENDA_MEMORIALES_PATH}`;
      const html = await this.fetchWithRetry(url);
      const $ = cheerio.load(html);

      // Hacienda uses a structured list of memoriales
      // Try different patterns: table rows, list items, or generic links
      const rows: { title: string; href: string; dateStr: string }[] = [];

      // Pattern 1: Table rows with bill info
      $('table tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length >= 2) {
          const link = cells.first().find('a');
          const href = link.attr('href') || '';
          const title = link.text().trim() || cells.first().text().trim();
          const dateStr = cells.eq(1).text().trim();

          if (title.length > 5 && (href || title)) {
            rows.push({
              title,
              href: href.startsWith('http') ? href : href ? `${FISCAL_SOURCES.HACIENDA_BASE_URL}${href}` : '',
              dateStr,
            });
          }
        }
      });

      // Pattern 2: Generic link list if table not found
      if (rows.length === 0) {
        $('a').each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          const isPdf = href.toLowerCase().includes('.pdf');
          const hasNumber = /\d+/.test(text);

          if (text.length > 10 && (isPdf || hasNumber)) {
            rows.push({
              title: text,
              href: href.startsWith('http') ? href : href ? `${FISCAL_SOURCES.HACIENDA_BASE_URL}${href}` : '',
              dateStr: '',
            });
          }
        });
      }

      this.logger.log(`Found ${rows.length} memoriales on Hacienda page`);

      for (const row of rows.slice(0, 100)) {
        const billNumber = this.extractBillNumber(row.title);
        let publishedAt: Date | null = null;

        if (row.dateStr) {
          try {
            publishedAt = new Date(row.dateStr);
            if (isNaN(publishedAt.getTime())) publishedAt = null;
          } catch {
            publishedAt = null;
          }
        }

        results.push({
          bill_number: billNumber,
          source_agency: AGENCY_NAMES.HACIENDA,
          source_url: url,
          document_url: row.href.includes('.pdf') ? row.href : null,
          title: row.title.slice(0, 500),
          published_at: publishedAt,
          raw_content: null,
        });
      }

      if (results.length === 0) {
        this.logger.warn('Hacienda scraper found 0 memoriales — portal may have changed structure');
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Hacienda scrape failed gracefully: ${msg}`);
    }

    return results;
  }

  async upsertNotes(notes: FiscalNoteDto[]): Promise<{ newCount: number; updatedCount: number }> {
    let newCount = 0;
    let updatedCount = 0;

    for (const note of notes) {
      try {
        let billId: string | null = null;
        if (note.bill_number) {
          const billRes = await this.db.query(
            `SELECT id FROM sutra_measures WHERE numero ILIKE $1 LIMIT 1`,
            [`%${note.bill_number.replace(/\s+/g, '%')}%`]
          );
          billId = billRes.rows[0]?.id || null;
        }

        const existing = await this.db.query(
          `SELECT id, published_at FROM fiscal_notes
           WHERE source_url = $1 AND source_agency = $2 AND title = $3 LIMIT 1`,
          [note.source_url, note.source_agency, note.title]
        );

        if (existing.rows.length > 0) {
          const existingDate = existing.rows[0].published_at
            ? new Date(existing.rows[0].published_at)
            : null;
          const newDate = note.published_at;
          const shouldUpdate = newDate && (!existingDate || newDate > existingDate);

          if (shouldUpdate) {
            await this.db.query(
              `UPDATE fiscal_notes SET bill_id = COALESCE($1, bill_id),
               bill_number = COALESCE($2, bill_number),
               document_url = COALESCE($3, document_url),
               published_at = $4, updated_at = NOW()
               WHERE id = $5`,
              [billId, note.bill_number, note.document_url, note.published_at, existing.rows[0].id]
            );
            updatedCount++;
          }
        } else {
          await this.db.query(
            `INSERT INTO fiscal_notes (bill_id, bill_number, source_agency, source_url,
             document_url, title, published_at, scraped_at, raw_content)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
            [billId, note.bill_number, note.source_agency, note.source_url,
             note.document_url, note.title, note.published_at, note.raw_content]
          );
          newCount++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to upsert Hacienda note: ${msg}`);
      }
    }

    return { newCount, updatedCount };
  }
}
