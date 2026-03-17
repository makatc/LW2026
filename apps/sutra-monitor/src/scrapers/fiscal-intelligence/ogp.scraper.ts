// FUENTE: https://bvirtualogp.pr.gov/Medidas%20Legislativas/
// Verificado: 2026-03-17
// La OGP tiene mandato legal de certificar el impacto fiscal de toda medida legislativa.
// La Biblioteca Virtual publica estos análisis organizados cronológicamente.
// Selectores CSS usados: tabla de documentos con enlaces .ms-listviewtable

import * as cheerio from 'cheerio';
import { Injectable } from '@nestjs/common';
import { BaseAgencyScraper, FiscalNoteDto } from './base-agency.scraper';
import { FISCAL_SOURCES, AGENCY_NAMES } from './fiscal-intelligence.constants';
import { DatabaseService } from '../../modules/database/database.service';

@Injectable()
export class OgpScraper extends BaseAgencyScraper {
  constructor(private readonly db: DatabaseService) {
    super('OgpScraper');
  }

  async scrape(): Promise<FiscalNoteDto[]> {
    this.logger.log('Starting OGP scrape...');
    const results: FiscalNoteDto[] = [];

    try {
      const url = `${FISCAL_SOURCES.OGP_BASE_URL}${FISCAL_SOURCES.OGP_MEASURES_PATH}`;
      const html = await this.fetchWithRetry(url);
      const $ = cheerio.load(html);

      // OGP Biblioteca Virtual SharePoint-style document library
      // Try multiple selectors to be resilient to layout changes
      const links: { href: string; text: string }[] = [];

      // Find PDF/document links with their context
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (
          text.length > 10 &&
          (href.includes('.pdf') || href.includes('.docx') || href.includes('Medidas'))
        ) {
          const fullHref = href.startsWith('http') ? href : `${FISCAL_SOURCES.OGP_BASE_URL}${href}`;
          links.push({ href: fullHref, text });
        }
      });

      this.logger.log(`Found ${links.length} document links on OGP page`);

      for (const link of links.slice(0, 50)) { // Process up to 50 docs
        const billNumber = this.extractBillNumber(link.text);

        const note: FiscalNoteDto = {
          bill_number: billNumber,
          source_agency: AGENCY_NAMES.OGP,
          source_url: url,
          document_url: link.href.includes('.pdf') || link.href.includes('.docx') ? link.href : null,
          title: link.text.slice(0, 500),
          published_at: null,
          raw_content: null,
        };

        results.push(note);
      }

      // If no links found, log but don't throw
      if (results.length === 0) {
        this.logger.warn('OGP scraper found 0 documents — portal may have changed structure');
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OGP scrape failed gracefully: ${msg}`);
      // Return empty array — do not propagate
    }

    return results;
  }

  async upsertNotes(notes: FiscalNoteDto[]): Promise<{ newCount: number; updatedCount: number }> {
    let newCount = 0;
    let updatedCount = 0;

    for (const note of notes) {
      try {
        // Try to match bill_id from sutra_measures
        let billId: string | null = null;
        if (note.bill_number) {
          const billRes = await this.db.query(
            `SELECT id FROM sutra_measures WHERE numero ILIKE $1 LIMIT 1`,
            [`%${note.bill_number.replace(/\s+/g, '%')}%`]
          );
          billId = billRes.rows[0]?.id || null;
        }

        // Deduplication: check by source_url + title
        const existing = await this.db.query(
          `SELECT id FROM fiscal_notes WHERE source_url = $1 AND title = $2 LIMIT 1`,
          [note.source_url, note.title]
        );

        if (existing.rows.length > 0) {
          // Update only if we have new data
          await this.db.query(
            `UPDATE fiscal_notes SET bill_id = COALESCE($1, bill_id), bill_number = COALESCE($2, bill_number),
             document_url = COALESCE($3, document_url), updated_at = NOW()
             WHERE id = $4`,
            [billId, note.bill_number, note.document_url, existing.rows[0].id]
          );
          updatedCount++;
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
        this.logger.warn(`Failed to upsert fiscal note "${note.title}": ${msg}`);
      }
    }

    return { newCount, updatedCount };
  }
}
