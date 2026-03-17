import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { chromium, Browser } from 'playwright';
import { ScrapedMeasure } from '../types';

@Injectable()
export class SutraScraper implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SutraScraper.name);
    private browser!: Browser;

    async onModuleInit() {
        this.logger.log('SutraScraper Module Initialized. Browser will be lazy-launched on first scrape.');
    }

    private async ensureBrowser() {
        if (!this.browser) {
            this.logger.log('🚀 Launching Playwright Browser...');
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox']
            });
            this.logger.log('✅ Browser launched successfully.');
        }
    }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async scrapeLatest(): Promise<ScrapedMeasure[]> {
        await this.ensureBrowser();
        const page = await this.browser.newPage();
        const results: ScrapedMeasure[] = [];

        try {
            this.logger.log('Navigating to new SUTRA medidas page...');
            await page.goto('https://sutra.oslpr.org/medidas', { waitUntil: 'networkidle', timeout: 60000 });

            // Wait for dynamic content to load
            await page.waitForTimeout(3000);

            // Extract measures via href-based DOM detection (works with React SPA)
            // SUTRA renders measure numbers in link hrefs as /medidas/PC1234 (no space)
            const measures = await page.evaluate(() => {
                const results: any[] = [];
                const seen = new Set<string>();

                // Strategy 1: find all links pointing to measure detail pages
                const links = Array.from(document.querySelectorAll('a[href*="/medidas/"]'));
                links.forEach(a => {
                    const href = (a as HTMLAnchorElement).href || a.getAttribute('href') || '';
                    // Match /medidas/PC1234 or /medidas/PS 0034 (URL-encoded or not)
                    const m = href.match(/\/medidas\/([A-Z]{1,4}\s*\d{1,5})/i);
                    if (!m) return;
                    const numero = m[1].replace(/\s+/g, '');
                    if (seen.has(numero)) return;
                    seen.add(numero);

                    // Try to get surrounding row/card text for pre-fetching
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
                        url: (a as HTMLAnchorElement).href,
                        fecha: extractField('Radicada') || extractField('Fecha') || null,
                        titulo: extractField('Título') || extractField('Titulo') || `Medida ${numero}`,
                        commission: extractField('Comisi') || null,
                        author: extractField('Autor') || extractField('Autores') || null,
                    });
                });

                // Strategy 2: fallback — look for measure numbers as plain text patterns
                // in case links are not present but text mentions them
                if (results.length === 0) {
                    const bodyText = document.body.innerText;
                    const numPattern = /\b(P[SC]|R[SC]|RCS|RCC|OA)\s*(\d{1,5})\b/g;
                    let match;
                    while ((match = numPattern.exec(bodyText)) !== null) {
                        const numero = `${match[1]}${match[2]}`;
                        if (seen.has(numero)) continue;
                        seen.add(numero);
                        results.push({
                            numero,
                            url: `https://sutra.oslpr.org/medidas/${numero}`,
                            fecha: null,
                            titulo: `Medida ${numero}`,
                            commission: null,
                            author: null,
                        });
                    }
                }

                return results;
            });

            this.logger.log(`Found ${measures.length} measures. Scraping details for first 20...`);

            // Limit to 20 to avoid timeout
            const toScrape = measures.slice(0, 20);

            for (const m of toScrape) {
                try {
                    // Only scrape detail if we have a valid URL
                    if (m.url.includes('/medidas/')) {
                        const details = await this.scrapeMeasureDetail(m.url);
                        results.push({ ...m, ...details });
                    } else {
                        results.push(m);
                    }
                    // Politeness delay
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    this.logger.error(`Failed to scrape details for ${m.numero}`, e);
                    results.push(m);
                }
            }

            return results;
        } catch (error) {
            this.logger.error('Failed to scrape SUTRA', error);
            return results;
        } finally {
            await page.close();
        }
    }

    private async scrapeMeasureDetail(url: string) {
        const page = await this.browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Extract Title (usually in a span or div with specific class, defaulting to finding text)
            // Strategy: Look for the measure number in text, the title is usually nearby or we grab the main header
            // For now, heuristic: Grab the first h1 or h2 or a large text block found?
            // Better: Inspect typical structure. Since we can't inspect, try to find "Título:" label.

            const data = await page.evaluate(() => {
                const bodyText = document.body.innerText;

                // Helper to clean up strings
                const clean = (text: string | null) => {
                    if (!text) return null;
                    return text.trim().replace(/\s+/g, ' ');
                };

                // Strategy: Try multiple regex patterns for each field
                const findMatch = (patterns: RegExp[]) => {
                    for (const p of patterns) {
                        const m = bodyText.match(p);
                        if (m && m[1]) return clean(m[1]);
                    }
                    return null;
                };

                const title = findMatch([
                    /Título[:\.]*\s*(.+)/i,
                    /^Título\s*\n(.+)/m
                ]) || findMatch([
                    /^(.{10,200})\n/m  // fallback: first non-empty line of content
                ]) || 'Título no encontrado';

                const commission = findMatch([
                    /Comisii?ón[:\.]?\s*(.+)(\n|$)/i, // Handle 'Comisión' or typo 'Comision'
                    /Referido a[:\.]?\s*(.+)(\n|$)/i,
                    /Comisión de[:\.]?\s*(.+)(\n|$)/i
                ]);

                const author = findMatch([
                    /(?:Autor|Autores|Presentado por|Por)[:\.]?\s*(.+)(\n|$)/i,
                    /Medida de la autoría d(?:el|a)(?:\s+Hon\.?)?\s*(.+)(\n|$)/i,
                    /Suscitado por[:\.]?\s*(.+)(\n|$)/i
                ]);

                return {
                    titulo: title,
                    commission: commission,
                    author: author,
                    // Extract text for hashing (limit length)
                    extracto: bodyText.substring(0, 3000)
                };
            });

            return data;
        } finally {
            await page.close();
        }
    }

    async scrapeCommissionsList(): Promise<string[]> {
        await this.ensureBrowser();
        // Use a new page context to avoid interference
        const context = await this.browser.newContext();
        const page = await context.newPage();

        try {
            this.logger.log('Scraping commissions list from https://sutra.oslpr.org/medidas...');
            await page.goto('https://sutra.oslpr.org/medidas', { waitUntil: 'networkidle', timeout: 60000 });

            // Try to find the "Comisiones" label and interact with it
            // We use Playwright locators for better reliability
            const label = page.getByText('Comisiones', { exact: true });

            if (await label.isVisible()) {
                const id = await label.getAttribute('for');
                this.logger.log(`Found label for id: ${id}`);

                if (id) {
                    // Strategy 1: Sibling Button
                    const siblingBtn = page.locator(`button[id*="${id}"]`); // Try strict ID match or similar
                    // Actually, headless UI buttons often have generated IDs.
                    // Let's try finding the button next to the input
                    const input = page.locator(`#${id}`);

                    if (await input.count() > 0) {
                        // Click input to focus
                        await input.click();
                        // Press ArrowDown to open listbox (standard combobox behavior)
                        await input.press('ArrowDown');
                        await page.waitForTimeout(500);

                        // Check if listbox appeared
                        if (await page.locator('ul[role="listbox"]').isVisible()) {
                            this.logger.log('Listbox opened via input focus + ArrowDown');
                        } else {
                            // Strategy 2: Click the button explicitly if ArrowDown didn't work
                            const parent = input.locator('..');
                            const btn = parent.locator('button');
                            if (await btn.count() > 0) {
                                await btn.click();
                                await page.waitForTimeout(500);
                                if (await page.locator('ul[role="listbox"]').isVisible()) {
                                    this.logger.log('Listbox opened via button click');
                                } else {
                                    // Try pressing ArrowDown on the button
                                    await btn.press('ArrowDown');
                                }
                            }
                        }
                    } else {
                        this.logger.warn(`Input with id ${id} not found`);
                    }
                } else {
                    // Fallback: Click the label and press TAB then Enter/ArrowDown?
                    await label.click();
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('ArrowDown');
                }

                // Wait for the listbox to appear
                const listbox = page.locator('ul[role="listbox"]');
                try {
                    await listbox.waitFor({ state: 'visible', timeout: 5000 });

                    // Extract all options
                    const options = await listbox.locator('li[role="option"]').allInnerTexts();

                    // Filter to only include items that start with "Comisión"
                    // This includes: "Comisión de...", "Comisión Conjunta...", "Comisión Especial...", etc.
                    // Excludes menu items like "Todos...", "Indice", etc.
                    const commissions = options
                        .map(t => t.trim())
                        .filter(t => t.startsWith('Comisión'));

                    this.logger.log(`Found ${commissions.length} valid commissions (filtered from ${options.length} total options).`);
                    return commissions;
                } catch (e) {
                    this.logger.warn('Listbox did not appear after interaction attempts.', e);
                }
            } else {
                this.logger.warn('Comisiones label not found.');
            }

            return [];
        } catch (error) {
            this.logger.error('Failed to scrape commissions list', error);
            return [];
        } finally {
            await page.close();
            await context.close();
        }
    }
}
