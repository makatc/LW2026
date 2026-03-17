// FUENTE: https://oversightboard.pr.gov/legislative-process/
// Verificado: 2026-03-17
// La FOMB documenta públicamente cada ley que objeta u certifica.
// La página está organizada cronológicamente: número de ley, fecha de carta, resumen.
// Ejemplos reales: Ley 224-2024 (pensiones), Ley 215-2024 (contratación pública)
// Base legal típica: Sección 204(a) de PROMESA
// Selectores: tabla o lista con law_number, fecha, resumen, link al PDF

import * as cheerio from 'cheerio';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { BaseAgencyScraper } from './base-agency.scraper';
import { FISCAL_SOURCES, LAW_NUMBER_PATTERN } from './fiscal-intelligence.constants';
import { DatabaseService } from '../../modules/database/database.service';

export interface FombActionDto {
  law_number: string | null;
  bill_number: string | null;
  bill_id: string | null;
  action_type: string;
  implementation_status: string;
  fomb_letter_date: Date | null;
  fomb_letter_url: string | null;
  summary: string;
  promesa_basis: string | null;
  fiscal_plan_reference: string | null;
}

@Injectable()
export class FombScraper extends BaseAgencyScraper<FombActionDto> {
  constructor(private readonly db: DatabaseService) {
    super('FombScraper');
  }

  async scrape(): Promise<FombActionDto[]> {
    this.logger.log('Starting FOMB scrape...');
    const results: FombActionDto[] = [];

    try {
      const url = `${FISCAL_SOURCES.FOMB_BASE_URL}${FISCAL_SOURCES.FOMB_LEGISLATIVE_PATH}`;
      const html = await this.fetchWithRetry(url);
      const $ = cheerio.load(html);

      // FOMB legislative process page — look for table rows or list items with law numbers
      const entries: { lawNumber: string | null; dateStr: string; summary: string; href: string }[] = [];

      // Pattern 1: Table-based layout
      $('table tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length >= 2) {
          const text = cells.first().text().trim();
          const rowText = $(tr).text();

          LAW_NUMBER_PATTERN.lastIndex = 0;
          const lawMatch = LAW_NUMBER_PATTERN.exec(text) || (() => {
            LAW_NUMBER_PATTERN.lastIndex = 0;
            return LAW_NUMBER_PATTERN.exec(rowText);
          })();
          LAW_NUMBER_PATTERN.lastIndex = 0;

          const link = $(tr).find('a');
          const href = link.attr('href') || '';

          entries.push({
            lawNumber: lawMatch ? lawMatch[0] : null,
            dateStr: cells.eq(1).text().trim() || cells.eq(0).text().trim(),
            summary: rowText.trim().slice(0, 1000),
            href: href.startsWith('http') ? href : href ? `${FISCAL_SOURCES.FOMB_BASE_URL}${href}` : '',
          });
        }
      });

      // Pattern 2: Article/card-based layout (common in WordPress sites)
      if (entries.length === 0) {
        $('article, .entry, .post, .card, [class*="action"]').each((_, el) => {
          const text = $(el).text().trim();
          LAW_NUMBER_PATTERN.lastIndex = 0;
          const lawMatch = LAW_NUMBER_PATTERN.exec(text);
          LAW_NUMBER_PATTERN.lastIndex = 0;

          const link = $(el).find('a').first();
          const href = link.attr('href') || '';

          if (text.length > 20) {
            entries.push({
              lawNumber: lawMatch ? lawMatch[0] : null,
              dateStr: $(el).find('time, .date, [class*="date"]').first().text().trim(),
              summary: text.slice(0, 1000),
              href: href.startsWith('http') ? href : href ? `${FISCAL_SOURCES.FOMB_BASE_URL}${href}` : '',
            });
          }
        });
      }

      // Pattern 3: List items
      if (entries.length === 0) {
        $('li').each((_, li) => {
          const text = $(li).text().trim();
          LAW_NUMBER_PATTERN.lastIndex = 0;
          const lawMatch = LAW_NUMBER_PATTERN.exec(text);
          LAW_NUMBER_PATTERN.lastIndex = 0;

          const link = $(li).find('a').first();
          const href = link.attr('href') || '';

          if (lawMatch || text.includes('Ley')) {
            entries.push({
              lawNumber: lawMatch ? lawMatch[0] : null,
              dateStr: '',
              summary: text.slice(0, 1000),
              href: href.startsWith('http') ? href : href ? `${FISCAL_SOURCES.FOMB_BASE_URL}${href}` : '',
            });
          }
        });
      }

      this.logger.log(`Found ${entries.length} FOMB entries`);

      for (const entry of entries) {
        const actionType = this.classifyActionType(entry.summary);
        const implementationStatus = this.classifyImplementationStatus(entry.summary);
        const promesaBasis = this.extractPromesaBasis(entry.summary);

        let letterDate: Date | null = null;
        if (entry.dateStr) {
          try {
            letterDate = new Date(entry.dateStr);
            if (isNaN(letterDate.getTime())) letterDate = null;
          } catch {
            letterDate = null;
          }
        }

        // Try to match bill_id from law_number
        let billId: string | null = null;
        if (entry.lawNumber) {
          const lawMatch = /Ley\s+(\d+)-(\d{4})/.exec(entry.lawNumber);
          if (lawMatch) {
            const billRes = await this.db.query(
              `SELECT id FROM sutra_measures WHERE numero ILIKE $1 LIMIT 1`,
              [`%${lawMatch[1]}%`]
            ).catch(() => ({ rows: [] as any[] }));
            billId = billRes.rows[0]?.id || null;
          }
        }

        results.push({
          law_number: entry.lawNumber,
          bill_number: null,
          bill_id: billId,
          action_type: actionType,
          implementation_status: implementationStatus,
          fomb_letter_date: letterDate,
          fomb_letter_url: entry.href.includes('.pdf') ? entry.href : null,
          summary: entry.summary.slice(0, 2000),
          promesa_basis: promesaBasis,
          fiscal_plan_reference: null,
        });
      }

      if (results.length === 0) {
        this.logger.warn('FOMB scraper found 0 actions — portal may have changed structure');
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`FOMB scrape failed gracefully: ${msg}`);
    }

    return results;
  }

  private classifyActionType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('significativamente inconsistente') || lower.includes('significantly inconsistent')) {
      return 'objection';
    }
    if (lower.includes('impairs or defeats') || lower.includes('no implementar') || lower.includes('not implement')) {
      return 'call_to_not_implement';
    }
    if (lower.includes('sección 204') || lower.includes('section 204') || lower.includes('204(a)')) {
      return 'section_204_certification';
    }
    if (lower.includes('cumple') || lower.includes('complies with') || lower.includes('compliant')) {
      return 'compliance_determination';
    }
    return 'under_review';
  }

  private classifyImplementationStatus(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('no implementar') || lower.includes('not implement') || lower.includes('blocked')) {
      return 'blocked';
    }
    if (lower.includes('discutir alternativas') || lower.includes('discuss alternatives') || lower.includes('negoci')) {
      return 'negotiating';
    }
    if (lower.includes('cumple') || lower.includes('complies') || lower.includes('compliant')) {
      return 'compliant';
    }
    return 'under_review';
  }

  private extractPromesaBasis(text: string): string | null {
    const match = /(?:Sección|Section)\s+\d+(?:\([a-z]\))?(?:\s+de\s+PROMESA)?/.exec(text);
    return match ? match[0] : null;
  }

  async upsertActions(actions: FombActionDto[]): Promise<{ newCount: number; updatedCount: number }> {
    let newCount = 0;
    let updatedCount = 0;

    for (const action of actions) {
      try {
        // Check if law_number already exists
        const existing = await this.db.query(
          `SELECT id FROM fomb_actions WHERE law_number = $1 LIMIT 1`,
          [action.law_number]
        );

        if (existing.rows.length > 0) {
          await this.db.query(
            `UPDATE fomb_actions SET action_type = $1, implementation_status = $2,
             fomb_letter_date = COALESCE($3, fomb_letter_date),
             fomb_letter_url = COALESCE($4, fomb_letter_url),
             summary = $5, promesa_basis = COALESCE($6, promesa_basis),
             bill_id = COALESCE($7, bill_id), scraped_at = NOW()
             WHERE id = $8`,
            [action.action_type, action.implementation_status, action.fomb_letter_date,
             action.fomb_letter_url, action.summary, action.promesa_basis,
             action.bill_id, existing.rows[0].id]
          );
          updatedCount++;
        } else {
          await this.db.query(
            `INSERT INTO fomb_actions (bill_id, law_number, bill_number, action_type,
             implementation_status, fomb_letter_date, fomb_letter_url, summary,
             promesa_basis, scraped_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [action.bill_id, action.law_number, action.bill_number, action.action_type,
             action.implementation_status, action.fomb_letter_date, action.fomb_letter_url,
             action.summary, action.promesa_basis]
          );
          newCount++;

          // Alert on new blocking actions via Redis pub/sub
          if (action.implementation_status === 'blocked') {
            await this.publishBlockingAlert(action).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.warn(`Failed to publish FOMB blocking alert: ${msg}`);
            });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to upsert FOMB action ${action.law_number}: ${msg}`);
      }
    }

    return { newCount, updatedCount };
  }

  private async publishBlockingAlert(action: FombActionDto): Promise<void> {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6380', 10);
    const url = process.env.REDIS_URL;

    let client: Redis;
    try {
      client = url ? new Redis(url) : new Redis({ host, port });

      await client.publish('fomb:new_blocking_action', JSON.stringify({
        law_number: action.law_number,
        summary: action.summary,
        fomb_letter_date: action.fomb_letter_date,
        fomb_letter_url: action.fomb_letter_url,
        timestamp: new Date().toISOString(),
      }));

      await client.quit();
      this.logger.log(`Published FOMB blocking alert for ${action.law_number}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis pub/sub unavailable for FOMB alert: ${msg}`);
    }
  }
}
