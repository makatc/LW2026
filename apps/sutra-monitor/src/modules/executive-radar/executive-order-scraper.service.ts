// FUENTE: estado.pr.gov + fortaleza.pr.gov
// Verificado: 2026-03-17
// IMPORTANTE: Si el scraper falla por cambio en portal, loggear con warn, NUNCA lanzar hacia arriba

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { DatabaseService } from '../database/database.service';
import { EXECUTIVE_RADAR_CONSTANTS, ValidSector } from './executive-radar.constants';

interface ScrapedOE {
  order_number: string;
  year: number;
  title: string;
  signed_date?: string;
  pdf_url: string;
  estado_url?: string;
  fortaleza_url?: string;
}

interface GeminiOEAnalysis {
  summary: string;
  agencies_involved: string[];
  sectors_affected: string[];
  referenced_legislation: Array<{ type: string; number: string; description: string }>;
  creates_or_modifies_regulations: boolean;
  urgency_assessment: 'routine' | 'significant' | 'critical';
}

@Injectable()
export class ExecutiveOrderScraperService {
  private readonly logger = new Logger(ExecutiveOrderScraperService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Nightly cron: 2:00 AM Puerto Rico time = 6:00 AM UTC ───────────────────
  @Cron('0 6 * * *', { timeZone: 'America/Puerto_Rico' })
  async scrapeAll(): Promise<void> {
    this.logger.log('Starting executive order scrape cycle...');
    let processed = 0;
    let errors = 0;

    try {
      const [estadoOrders, fortalezaOrders] = await Promise.allSettled([
        this.scrapeEstadoPR(),
        this.scrapeFortalezaPR(),
      ]);

      const allOrders: ScrapedOE[] = [];

      if (estadoOrders.status === 'fulfilled') {
        allOrders.push(...estadoOrders.value);
      } else {
        this.logger.warn(`Estado.pr.gov scrape failed: ${estadoOrders.reason?.message || estadoOrders.reason}`);
      }

      if (fortalezaOrders.status === 'fulfilled') {
        allOrders.push(...fortalezaOrders.value);
      } else {
        this.logger.warn(`Fortaleza.pr.gov scrape failed: ${fortalezaOrders.reason?.message || fortalezaOrders.reason}`);
      }

      // Deduplicate by order_number
      const seen = new Set<string>();
      const unique = allOrders.filter(oe => {
        if (seen.has(oe.order_number)) return false;
        seen.add(oe.order_number);
        return true;
      });

      this.logger.log(`Found ${unique.length} unique executive orders to process`);

      for (const oe of unique) {
        try {
          await this.processOrder(oe);
          processed++;
        } catch (err: unknown) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Error processing order ${oe.order_number}: ${msg}`);
        }
      }

      this.logger.log(`Executive order scrape complete: ${processed} processed, ${errors} errors`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Executive order scrape cycle failed: ${msg}`);
    }
  }

  // ─── Scrapers ────────────────────────────────────────────────────────────────

  private async scrapeEstadoPR(): Promise<ScrapedOE[]> {
    const results: ScrapedOE[] = [];

    try {
      const response = await axios.get(EXECUTIVE_RADAR_CONSTANTS.ESTADO_PR_URL, {
        timeout: 20000,
        headers: { 'User-Agent': 'LegalWatch/1.0 (monitor legislativo PR)' },
      });

      const $ = cheerio.load(response.data as string);
      const baseUrl = 'https://estado.pr.gov';

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        // Look for executive order links — they typically contain OE/EO numbering
        if (
          text.length > 5 &&
          (href.toLowerCase().includes('.pdf') ||
            text.match(/OE[-\s]?\d{4}/i) ||
            text.match(/Orden\s+Ejecutiva/i))
        ) {
          const fullHref = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
          const orderNumber = this.extractOrderNumber(text) || this.extractOrderNumber(href);

          if (orderNumber) {
            const year = this.extractYear(orderNumber) || new Date().getFullYear();
            results.push({
              order_number: orderNumber,
              year,
              title: text.slice(0, 500),
              pdf_url: fullHref.includes('.pdf') ? fullHref : '',
              estado_url: fullHref,
            });
          }
        }
      });

      if (results.length === 0) {
        this.logger.warn('Estado.pr.gov: 0 executive orders found — portal structure may have changed');
      } else {
        this.logger.log(`Estado.pr.gov: found ${results.length} orders`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`scrapeEstadoPR failed: ${msg}`);
    }

    return results;
  }

  private async scrapeFortalezaPR(): Promise<ScrapedOE[]> {
    const results: ScrapedOE[] = [];

    try {
      const response = await axios.get(EXECUTIVE_RADAR_CONSTANTS.FORTALEZA_PR_URL, {
        timeout: 20000,
        headers: { 'User-Agent': 'LegalWatch/1.0 (monitor legislativo PR)' },
      });

      const $ = cheerio.load(response.data as string);
      const baseUrl = 'https://fortaleza.pr.gov';

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        if (
          text.length > 5 &&
          (href.toLowerCase().includes('.pdf') ||
            text.match(/OE[-\s]?\d{4}/i) ||
            text.match(/Orden\s+Ejecutiva/i) ||
            href.match(/orden/i))
        ) {
          const fullHref = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
          const orderNumber = this.extractOrderNumber(text) || this.extractOrderNumber(href);

          if (orderNumber) {
            const year = this.extractYear(orderNumber) || new Date().getFullYear();
            results.push({
              order_number: orderNumber,
              year,
              title: text.slice(0, 500),
              pdf_url: fullHref.includes('.pdf') ? fullHref : '',
              fortaleza_url: fullHref,
            });
          }
        }
      });

      if (results.length === 0) {
        this.logger.warn('Fortaleza.pr.gov: 0 executive orders found — portal structure may have changed');
      } else {
        this.logger.log(`Fortaleza.pr.gov: found ${results.length} orders`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`scrapeFortalezaPR failed: ${msg}`);
    }

    return results;
  }

  // ─── Order processing ────────────────────────────────────────────────────────

  private async processOrder(oe: ScrapedOE): Promise<void> {
    // 1. Check if already exists by order_number — skip if same source_url
    const existing = await this.db.query(
      `SELECT id, source_url FROM executive_orders WHERE order_number = $1 LIMIT 1`,
      [oe.order_number]
    ).catch(() => ({ rows: [] }));

    if (existing.rows.length > 0) {
      const existingPdfUrl: string = existing.rows[0].source_url || '';
      if (existingPdfUrl && oe.pdf_url && existingPdfUrl === oe.pdf_url) {
        this.logger.debug(`Order ${oe.order_number} already exists with same source URL — skipping`);
        return;
      }
      // Update source URL / portal URLs if new data
      await this.db.query(
        `UPDATE executive_orders
         SET source_url = COALESCE(NULLIF($1, ''), source_url),
             estado_url = COALESCE($2, estado_url),
             fortaleza_url = COALESCE($3, fortaleza_url),
             updated_at = NOW()
         WHERE id = $4`,
        [oe.pdf_url || null, oe.estado_url || null, oe.fortaleza_url || null, existing.rows[0].id]
      ).catch(() => {});
      return;
    }

    // 2. Extract PDF text with pdf-parse
    let pdfText = '';
    if (oe.pdf_url) {
      pdfText = await this.extractPdfText(oe.pdf_url);
    }

    // 3. If PDF is scanned (no text extracted), log warning and skip OCR
    if (!pdfText && oe.pdf_url) {
      this.logger.warn(`Order ${oe.order_number}: PDF appears scanned — text extraction failed, skipping OCR for now`);
    }

    // 4. Call Gemini for analysis
    let analysis: GeminiOEAnalysis | null = null;
    const textForAnalysis = pdfText || oe.title;
    if (textForAnalysis.length > 20) {
      analysis = await this.callGeminiAnalysis(textForAnalysis, oe.order_number);
    }

    // 5. Determine signed_date
    let signedDate: string | null = oe.signed_date || null;
    if (!signedDate && pdfText) {
      signedDate = this.extractDateFromText(pdfText);
    }

    // 6. Save to executive_orders
    // NOTE: column names match existing schema in database-migration.service.ts:
    // raw_content (not full_text), ai_summary (not summary), source_url = pdf_url
    const insertRes = await this.db.query(
      `INSERT INTO executive_orders
         (order_number, year, title, signed_date, source_url, estado_url, fortaleza_url,
          raw_content, ai_summary, agencies_involved, sectors_affected,
          referenced_legislation, urgency_assessment, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (order_number) DO UPDATE SET
         title = EXCLUDED.title,
         source_url = COALESCE(EXCLUDED.source_url, executive_orders.source_url),
         raw_content = COALESCE(EXCLUDED.raw_content, executive_orders.raw_content),
         ai_summary = COALESCE(EXCLUDED.ai_summary, executive_orders.ai_summary),
         agencies_involved = COALESCE(EXCLUDED.agencies_involved, executive_orders.agencies_involved),
         sectors_affected = COALESCE(EXCLUDED.sectors_affected, executive_orders.sectors_affected),
         referenced_legislation = COALESCE(EXCLUDED.referenced_legislation, executive_orders.referenced_legislation),
         urgency_assessment = COALESCE(EXCLUDED.urgency_assessment, executive_orders.urgency_assessment),
         updated_at = NOW()
       RETURNING id`,
      [
        oe.order_number,
        oe.year,
        oe.title,
        signedDate,
        oe.pdf_url || null,
        oe.estado_url || null,
        oe.fortaleza_url || null,
        pdfText || null,
        analysis?.summary || null,
        analysis ? JSON.stringify(analysis.agencies_involved) : null,
        analysis ? JSON.stringify(analysis.sectors_affected) : null,
        analysis ? JSON.stringify(analysis.referenced_legislation) : null,
        analysis?.urgency_assessment || 'routine',
      ]
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to insert executive order ${oe.order_number}: ${msg}`);
      return { rows: [] };
    });

    if (insertRes.rows.length === 0) return;
    const orderId: string = insertRes.rows[0].id;

    // 7. Create portfolio alerts for matching users
    if (analysis?.sectors_affected && analysis.sectors_affected.length > 0) {
      await this.createPortfolioAlerts(orderId, analysis.sectors_affected);
    }

    this.logger.log(`Saved executive order ${oe.order_number} (urgency: ${analysis?.urgency_assessment || 'routine'})`);
  }

  // ─── PDF text extraction ─────────────────────────────────────────────────────

  private async extractPdfText(pdfUrl: string): Promise<string> {
    try {
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'LegalWatch/1.0' },
      });

      // Dynamic require to avoid top-level issues with pdf-parse v2
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      // pdf-parse v2 uses class instance
      let result: any;
      if (pdfParse.PDFParse) {
        result = await new pdfParse.PDFParse().pdf(Buffer.from(response.data as ArrayBuffer));
      } else {
        result = await pdfParse(Buffer.from(response.data as ArrayBuffer));
      }

      return (result.text || '').trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`PDF extraction failed for ${pdfUrl}: ${msg}`);
      return '';
    }
  }

  // ─── Gemini analysis ─────────────────────────────────────────────────────────

  private async callGeminiAnalysis(oeText: string, oeNumber: string): Promise<GeminiOEAnalysis> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — returning stub analysis for OE ' + oeNumber);
      return this.stubAnalysis();
    }

    const prompt = `Eres un analista legal especializado en derecho administrativo de Puerto Rico.
Analiza la siguiente Orden Ejecutiva del Gobierno de Puerto Rico (${oeNumber}) y devuelve un JSON con este formato exacto:

{
  "summary": "Resumen ejecutivo en 2-3 oraciones en español",
  "agencies_involved": ["Lista de agencias gubernamentales mencionadas"],
  "sectors_affected": ["Lista de sectores usando SOLO estos valores: energy, permits, health, education, fiscal, labor, housing, environment, infrastructure, other"],
  "referenced_legislation": [
    {"type": "ley|reglamento|orden_ejecutiva", "number": "número", "description": "descripción breve"}
  ],
  "creates_or_modifies_regulations": true,
  "urgency_assessment": "routine|significant|critical"
}

TEXTO DE LA ORDEN EJECUTIVA:
${oeText.slice(0, 8000)}

Responde SOLO con el JSON, sin texto adicional.`;

    try {
      const response = await axios.post(
        `${EXECUTIVE_RADAR_CONSTANTS.GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        },
        { timeout: 30000 }
      );

      const rawText: string =
        (response.data as any)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.parseGeminiJson(rawText, oeNumber);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gemini analysis failed for OE ${oeNumber}: ${msg}`);
      return this.stubAnalysis();
    }
  }

  // Robust JSON parser — handles extra text before/after JSON block
  private parseGeminiJson(rawText: string, oeNumber: string): GeminiOEAnalysis {
    try {
      // Try to extract JSON block between first { and last }
      const startIdx = rawText.indexOf('{');
      const endIdx = rawText.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error('No JSON object found in response');
      }
      const jsonStr = rawText.slice(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr) as Partial<GeminiOEAnalysis>;

      // Validate and sanitize sectors
      const validSectors = EXECUTIVE_RADAR_CONSTANTS.VALID_SECTORS as readonly string[];
      const sectors = Array.isArray(parsed.sectors_affected)
        ? parsed.sectors_affected.filter((s: string) => validSectors.includes(s))
        : [];

      return {
        summary: parsed.summary || `Orden Ejecutiva ${oeNumber}`,
        agencies_involved: Array.isArray(parsed.agencies_involved) ? parsed.agencies_involved : [],
        sectors_affected: sectors.length > 0 ? sectors : ['other'],
        referenced_legislation: Array.isArray(parsed.referenced_legislation)
          ? parsed.referenced_legislation
          : [],
        creates_or_modifies_regulations: Boolean(parsed.creates_or_modifies_regulations),
        urgency_assessment: (['routine', 'significant', 'critical'] as const).includes(
          parsed.urgency_assessment as any
        )
          ? (parsed.urgency_assessment as GeminiOEAnalysis['urgency_assessment'])
          : 'routine',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to parse Gemini JSON for ${oeNumber}: ${msg}`);
      return this.stubAnalysis();
    }
  }

  private stubAnalysis(): GeminiOEAnalysis {
    return {
      summary: 'Análisis automático no disponible — GEMINI_API_KEY no configurado o error de API.',
      agencies_involved: [],
      sectors_affected: ['other'],
      referenced_legislation: [],
      creates_or_modifies_regulations: false,
      urgency_assessment: 'routine',
    };
  }

  // ─── Portfolio alerts ────────────────────────────────────────────────────────

  private async createPortfolioAlerts(orderId: string, sectorsAffected: string[]): Promise<void> {
    try {
      // Find bills in sutra_measures that match any affected sector
      // Using bill_type as sector proxy (same convention as fiscal intelligence module)
      const matchingBills = await this.db.query(
        `SELECT DISTINCT sm.id AS bill_id, sm.numero
         FROM sutra_measures sm
         WHERE sm.bill_type = ANY($1::text[])
           AND sm.status NOT IN ('enacted', 'vetoed', 'withdrawn')`,
        [sectorsAffected]
      ).catch(() => ({ rows: [] }));

      if (matchingBills.rows.length === 0) return;

      const billIds = matchingBills.rows.map((r: any) => r.bill_id);

      // Find users tracking those bills
      const trackers = await this.db.query(
        `SELECT DISTINCT user_id, measure_id
         FROM watchlist_items
         WHERE measure_id = ANY($1::uuid[])`,
        [billIds]
      ).catch(() => ({ rows: [] }));

      if (trackers.rows.length === 0) return;

      // Create alert for each user-bill pair
      for (const tracker of trackers.rows) {
        await this.db.query(
          `INSERT INTO executive_order_portfolio_alerts
             (executive_order_id, bill_id, user_id, created_at, dismissed)
           VALUES ($1, $2, $3, NOW(), false)
           ON CONFLICT (executive_order_id, bill_id, user_id) DO NOTHING`,
          [orderId, tracker.measure_id, tracker.user_id]
        ).catch(() => {});
      }

      this.logger.log(
        `Created portfolio alerts for OE ${orderId}: ${trackers.rows.length} user-bill pairs`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`createPortfolioAlerts failed for order ${orderId}: ${msg}`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private extractOrderNumber(text: string): string | null {
    // Matches patterns: OE-2026-001, OE 2026-1, Orden Ejecutiva 2026-001
    const match =
      text.match(/OE[-\s](\d{4}[-]\d{1,4})/i) ||
      text.match(/Orden\s+Ejecutiva\s+(\d{4}[-]\d{1,4})/i) ||
      text.match(/(\d{4}-\d{3,4})/);
    return match ? `OE-${match[1]}` : null;
  }

  private extractYear(orderNumber: string): number | null {
    const match = orderNumber.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
  }

  private extractDateFromText(text: string): string | null {
    // Look for Spanish date patterns in text
    const match = text.match(
      /(?:a los?|el día|firmado el|en|A\s+)?(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i
    );
    if (!match) return null;

    const monthMap: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04',
      mayo: '05', junio: '06', julio: '07', agosto: '08',
      septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    };
    const month = monthMap[match[2].toLowerCase()];
    if (!month) return null;

    return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
  }

  // ─── Manual trigger ──────────────────────────────────────────────────────────

  async manualScrape(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    const [estadoOrders, fortalezaOrders] = await Promise.allSettled([
      this.scrapeEstadoPR(),
      this.scrapeFortalezaPR(),
    ]);

    const allOrders: ScrapedOE[] = [];
    if (estadoOrders.status === 'fulfilled') allOrders.push(...estadoOrders.value);
    if (fortalezaOrders.status === 'fulfilled') allOrders.push(...fortalezaOrders.value);

    const seen = new Set<string>();
    const unique = allOrders.filter(oe => {
      if (seen.has(oe.order_number)) return false;
      seen.add(oe.order_number);
      return true;
    });

    for (const oe of unique) {
      try {
        await this.processOrder(oe);
        processed++;
      } catch {
        errors++;
      }
    }

    return { processed, errors };
  }
}
