import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { chromium, Browser } from 'playwright';
import { DatabaseService } from '../../modules/database/database.service';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { BaseScraper, PipelineResult } from '../base-scraper';
import { ChangeEventService } from '../change-event/change-event.service';

interface RawBill {
    numero: string;
    titulo: string;
    bill_type: string;
    status?: string;
    commission?: string;
    author?: string;
    author_names: string[];
    actions: BillAction[];
    fecha?: string;
    url: string;
    pdf_url?: string;
    extracto?: string;
}

interface BillAction {
    date?: string;
    type?: string;
    description: string;
}

const MAX_PAGES = parseInt(process.env.SUTRA_MAX_PAGES || '50', 10);

@Injectable()
export class BillsScraper implements BaseScraper {
    private readonly logger = new Logger(BillsScraper.name);
    readonly scraperName = 'bills';
    private browser?: Browser;

    constructor(
        private readonly db: DatabaseService,
        private readonly recorder: ScraperRunRecorder,
        @Optional() private readonly changeEvents?: ChangeEventService,
    ) {}

    async runPipeline(): Promise<PipelineResult> {
        const startTime = Date.now();
        const runId = await this.recorder.start(this.scraperName);

        try {
            this.logger.log('Starting bills scraping pipeline...');
            const raw = await this.scrape();
            this.logger.log(`Scraped ${raw.length} raw bills`);

            const { newCount, updatedCount } = await this.version(raw);

            await this.recorder.complete(runId, raw.length, newCount, updatedCount);
            return {
                scraperName: this.scraperName,
                recordsScraped: raw.length,
                recordsNew: newCount,
                recordsUpdated: updatedCount,
                durationMs: Date.now() - startTime,
            };
        } catch (error: any) {
            this.logger.error('Pipeline failed:', error.message);
            await this.recorder.fail(runId, error.message);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
                this.browser = undefined;
            }
        }
    }

    private async ensureBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
        }
        return this.browser;
    }

    private async scrape(): Promise<RawBill[]> {
        const browser = await this.ensureBrowser();
        const allBills: RawBill[] = [];
        let pageNum = 0;

        const page = await browser.newPage();
        try {
            this.logger.log('Navigating to SUTRA medidas...');
            await page.goto('https://sutra.oslpr.org/medidas', {
                waitUntil: 'networkidle',
                timeout: 60000,
            });
            await page.waitForTimeout(3000);

            while (pageNum < MAX_PAGES) {
                const pageBills = await page.evaluate(() => {
                    const results: any[] = [];
                    const seen = new Set<string>();

                    // Primary: find all medida detail links (SUTRA is a React SPA;
                    // measure numbers appear in hrefs as /medidas/PC1234, no space)
                    const links = Array.from(document.querySelectorAll('a[href*="/medidas/"]'));
                    links.forEach(a => {
                        const href = (a as HTMLAnchorElement).href || a.getAttribute('href') || '';
                        const m = href.match(/\/medidas\/([A-Z]{1,4}\s*\d{1,5})/i);
                        if (!m) return;
                        const numero = m[1].replace(/\s+/g, '');
                        if (seen.has(numero)) return;
                        seen.add(numero);

                        const container = (a as HTMLElement).closest(
                            'tr, li, article, [class*="row"], [class*="item"], [class*="card"], [class*="measure"], [class*="medida"]'
                        ) as HTMLElement | null;
                        const blockText = container ? container.innerText : '';

                        const extractField = (label: string) => {
                            const m2 = blockText.match(new RegExp(`${label}[:\\s]+([^\\n]{1,200})`, 'i'));
                            return m2 ? m2[1].trim() : null;
                        };

                        results.push({
                            numero,
                            titulo: extractField('Título') || extractField('Titulo') || `Medida ${numero}`,
                            fecha: extractField('Radicada') || extractField('Fecha') || null,
                            author: extractField('Autor') || extractField('Autores') || extractField('Presentado') || null,
                            commission: extractField('Comisi') || extractField('Referido') || null,
                            url: (a as HTMLAnchorElement).href,
                        });
                    });

                    // Fallback: look for measure number text patterns if no links found
                    if (results.length === 0) {
                        const bodyText = document.body.innerText;
                        const numPattern = /\b(P[SC]|R[SC]|RCS|RCC|OA)\s*(\d{1,5})\b/g;
                        let match;
                        while ((match = numPattern.exec(bodyText)) !== null) {
                            const numero = `${match[1]}${match[2]}`;
                            if (seen.has(numero)) continue;
                            seen.add(numero);
                            const startPos = match.index || 0;
                            const block = bodyText.substring(startPos, startPos + 600);
                            const extractField = (label: string) => {
                                const m2 = block.match(new RegExp(`${label}[:\\s]+([^\\n]{1,200})`, 'i'));
                                return m2 ? m2[1].trim() : null;
                            };
                            results.push({
                                numero,
                                titulo: extractField('Título') || `Medida ${numero}`,
                                fecha: extractField('Radicada') || extractField('Fecha') || null,
                                author: extractField('Autor') || extractField('Autores') || null,
                                commission: extractField('Comisi') || null,
                                url: `https://sutra.oslpr.org/medidas/${numero}`,
                            });
                        }
                    }

                    return results;
                });

                allBills.push(...pageBills.map(b => this.enrichBillData(b)));
                this.logger.log(`Page ${pageNum + 1}: found ${pageBills.length} bills`);

                // Try to navigate to next page
                const hasNext = await this.goToNextPage(page);
                if (!hasNext || pageBills.length === 0) {
                    this.logger.log(`No more pages after page ${pageNum + 1}`);
                    break;
                }

                pageNum++;
                await page.waitForTimeout(2000);
            }
        } finally {
            await page.close();
        }

        // Fetch details for the first N bills (limit to avoid timeout)
        const detailLimit = parseInt(process.env.BILL_DETAIL_LIMIT || '100', 10);
        return this.enrichWithDetails(allBills.slice(0, detailLimit), browser);
    }

    private async goToNextPage(page: any): Promise<boolean> {
        // Check for pagination controls
        try {
            const nextButton = await page.$(
                'button[aria-label*="siguiente"], button[aria-label*="next"], a[aria-label*="siguiente"], .pagination-next:not([disabled])'
            );
            if (nextButton) {
                const isDisabled = await nextButton.getAttribute('disabled');
                if (!isDisabled) {
                    await nextButton.click();
                    await page.waitForTimeout(3000);
                    return true;
                }
            }
        } catch { }
        return false;
    }

    private enrichBillData(raw: any): RawBill {
        const numero = raw.numero || '';
        return {
            numero,
            titulo: raw.titulo || `Medida ${numero}`,
            bill_type: this.detectBillType(numero),
            status: raw.status || undefined,
            commission: raw.commission || undefined,
            author: raw.author || undefined,
            author_names: raw.author ? [raw.author] : [],
            actions: [],
            fecha: raw.fecha || undefined,
            url: raw.url,
            extracto: raw.extracto || undefined,
        };
    }

    private async enrichWithDetails(bills: RawBill[], browser: Browser): Promise<RawBill[]> {
        const enriched: RawBill[] = [];

        for (const bill of bills) {
            if (!bill.url.includes('/medidas/')) {
                enriched.push(bill);
                continue;
            }

            try {
                const detail = await this.scrapeDetail(browser, bill.url);
                enriched.push({ ...bill, ...detail });
                await new Promise(r => setTimeout(r, 1500));
            } catch (err: any) {
                this.logger.warn(`Detail failed for ${bill.numero}: ${err.message}`);
                enriched.push(bill);
            }
        }

        return enriched;
    }

    private async scrapeDetail(browser: Browser, url: string): Promise<Partial<RawBill>> {
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            return await page.evaluate(() => {
                const bodyText = document.body.innerText;

                const findMatch = (patterns: RegExp[]) => {
                    for (const p of patterns) {
                        const m = bodyText.match(p);
                        if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ');
                    }
                    return null;
                };

                // Extract PDF URLs
                const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="pdf"]'));
                const pdfUrl = pdfLinks.length > 0 ? (pdfLinks[0] as HTMLAnchorElement).href : null;

                // Extract actions/history
                const actions: any[] = [];
                const actionRows = document.querySelectorAll('table tr, .historial-item, .action-row');
                actionRows.forEach(row => {
                    const text = (row as HTMLElement).innerText?.trim();
                    if (text && text.length > 5) {
                        const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
                        actions.push({
                            date: dateMatch ? dateMatch[0] : undefined,
                            description: text.replace(/\n+/g, ' ').substring(0, 200),
                        });
                    }
                });

                const status = findMatch([
                    /Estado[:\s]+([^\n]{1,100})/i,
                    /Status[:\s]+([^\n]{1,100})/i,
                ]);

                const commission = findMatch([
                    /Comisii?ón[:\s]+([^\n]{1,150})/i,
                    /Referido a[:\s]+([^\n]{1,150})/i,
                ]);

                const author = findMatch([
                    /(?:Autor|Autores|Presentado por)[:\s]+([^\n]{1,150})/i,
                    /Suscitado por[:\s]+([^\n]{1,150})/i,
                ]);

                return {
                    status: status || undefined,
                    commission: commission || undefined,
                    author: author || undefined,
                    author_names: author ? author.split(/,|y\s/i).map((n: string) => n.trim()).filter((n: string) => n.length > 3) : [],
                    actions: actions.slice(0, 20),
                    pdf_url: pdfUrl || undefined,
                    extracto: bodyText.substring(0, 3000),
                };
            });
        } finally {
            await page.close();
        }
    }

    private async version(bills: RawBill[]): Promise<{ newCount: number; updatedCount: number }> {
        let newCount = 0;
        let updatedCount = 0;

        for (const bill of bills) {
            try {
                const hash = crypto.createHash('sha256').update(JSON.stringify(bill)).digest('hex');

                // Resolve commission ID
                let commissionId: string | null = null;
                if (bill.commission) {
                    const slug = bill.commission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    const commRes = await this.db.query(
                        `INSERT INTO sutra_commissions (name, slug) VALUES ($1, $2)
                         ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
                        [bill.commission, slug]
                    );
                    commissionId = commRes.rows[0]?.id || null;
                }

                // Resolve author IDs
                const authorIds: string[] = [];
                for (const name of bill.author_names) {
                    const res = await this.db.query(
                        `SELECT id FROM legislators WHERE full_name ILIKE $1 LIMIT 1`,
                        [name.trim()]
                    );
                    if (res.rows.length > 0) authorIds.push(res.rows[0].id);
                }

                const existing = await this.db.query(
                    'SELECT id, hash FROM sutra_measures WHERE numero = $1',
                    [bill.numero]
                );

                if (existing.rows.length === 0) {
                    await this.db.query(
                        `INSERT INTO sutra_measures
                            (numero, titulo, extracto, comision_id, fecha, source_url, hash,
                             bill_type, status, actions, author_names, author_ids, last_seen_at, author)
                         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10::jsonb, $11::text[], $12::uuid[], NOW(), $13)`,
                        [
                            bill.numero,
                            bill.titulo,
                            bill.extracto || '',
                            commissionId,
                            bill.fecha || null,
                            bill.url,
                            hash,
                            bill.bill_type,
                            bill.status || null,
                            JSON.stringify(bill.actions),
                            bill.author_names.length > 0 ? bill.author_names : null,
                            authorIds.length > 0 ? authorIds : null,
                            bill.author || null,
                        ]
                    );
                    newCount++;
                    await this.changeEvents?.record({
                        entityType: 'bill',
                        eventType: 'created',
                        entityId: null, // ID not returned from INSERT (no RETURNING)
                        scraperName: this.scraperName,
                        summary: `New bill: ${bill.numero} — ${bill.titulo.substring(0, 80)}`,
                        after: { numero: bill.numero, titulo: bill.titulo, bill_type: bill.bill_type, status: bill.status },
                    });
                } else if (existing.rows[0].hash !== hash) {
                    await this.db.query(
                        `UPDATE sutra_measures SET
                            titulo = $1, extracto = $2, comision_id = $3, source_url = $4,
                            hash = $5, bill_type = $6, status = $7, actions = $8::jsonb,
                            author_names = $9::text[], author_ids = $10::uuid[],
                            author = $11, last_seen_at = NOW(), updated_at = NOW()
                         WHERE id = $12`,
                        [
                            bill.titulo, bill.extracto || '', commissionId, bill.url,
                            hash, bill.bill_type, bill.status || null,
                            JSON.stringify(bill.actions),
                            bill.author_names.length > 0 ? bill.author_names : null,
                            authorIds.length > 0 ? authorIds : null,
                            bill.author || null,
                            existing.rows[0].id,
                        ]
                    );
                    updatedCount++;
                    await this.changeEvents?.record({
                        entityType: 'bill',
                        eventType: 'updated',
                        entityId: existing.rows[0].id,
                        scraperName: this.scraperName,
                        summary: `Updated bill: ${bill.numero} — status: ${bill.status ?? 'unknown'}`,
                        after: { numero: bill.numero, titulo: bill.titulo, bill_type: bill.bill_type, status: bill.status },
                    });
                }

                // Resolve watchlist items
                if (existing.rows.length === 0) {
                    const newId = await this.db.query(
                        'SELECT id FROM sutra_measures WHERE numero = $1', [bill.numero]
                    );
                    if (newId.rows.length > 0) {
                        await this.db.query(
                            `UPDATE watchlist_items SET measure_id = $1 WHERE measure_number = $2 AND measure_id IS NULL`,
                            [newId.rows[0].id, bill.numero]
                        );
                    }
                }
            } catch (err: any) {
                this.logger.error(`Failed to version bill ${bill.numero}: ${err.message}`);
            }
        }

        return { newCount, updatedCount };
    }

    private detectBillType(numero: string): string {
        const prefix = numero.match(/^([A-Z]+)/)?.[1] || '';
        const map: Record<string, string> = {
            'PS': 'bill',          // Proyecto del Senado
            'PC': 'bill',          // Proyecto de la Cámara
            'RS': 'resolution',    // Resolución del Senado
            'RC': 'resolution',    // Resolución de la Cámara
            'RCS': 'resolution',   // Resolución Concurrente del Senado
            'RCC': 'resolution',   // Resolución Concurrente de la Cámara
            'RCS2': 'resolution',
            'OA': 'other',         // Orden de Acusar
            'RN': 'resolution',    // Resolución Núm.
        };
        return map[prefix] || 'bill';
    }
}
