"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SutraScraper_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SutraScraper = void 0;
const common_1 = require("@nestjs/common");
const playwright_1 = require("playwright");
let SutraScraper = exports.SutraScraper = SutraScraper_1 = class SutraScraper {
    constructor() {
        this.logger = new common_1.Logger(SutraScraper_1.name);
    }
    async onModuleInit() {
        this.logger.log('SutraScraper Module Initialized. Browser will be lazy-launched on first scrape.');
    }
    async ensureBrowser() {
        if (!this.browser) {
            this.logger.log('🚀 Launching Playwright Browser...');
            this.browser = await playwright_1.chromium.launch({
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
    async scrapeLatest() {
        await this.ensureBrowser();
        const page = await this.browser.newPage();
        const results = [];
        try {
            this.logger.log('Navigating to new SUTRA medidas page...');
            await page.goto('https://sutra.oslpr.org/medidas', { waitUntil: 'networkidle', timeout: 60000 });
            // Wait for dynamic content to load
            await page.waitForTimeout(3000);
            // Extract measures from the table/grid
            const measures = await page.evaluate(() => {
                const results = [];
                const bodyText = document.body.innerText;
                // Pattern: "Medida: XX0000" followed by details
                const measurePattern = /Medida:\s*([A-Z]{1,4}\d{1,5})/g;
                const matches = [...bodyText.matchAll(measurePattern)];
                // For each measure found, try to extract associated data
                matches.forEach((match, idx) => {
                    const numero = match[1];
                    const startPos = match.index || 0;
                    // Get text block after "Medida: XXX" (next ~500 chars)
                    const block = bodyText.substring(startPos, startPos + 500);
                    // Extract fields from this block
                    const extractField = (label) => {
                        const patterns = [
                            new RegExp(`${label}[:\\s]*([^\\n]+)`, 'i'),
                            new RegExp(`${label}\\s*\\n\\s*([^\\n]+)`, 'i')
                        ];
                        for (const p of patterns) {
                            const m = block.match(p);
                            if (m && m[1])
                                return m[1].trim();
                        }
                        return null;
                    };
                    const radicada = extractField('Radicada');
                    const titulo = extractField('Título');
                    // Try to find the detail link for this measure
                    const links = Array.from(document.querySelectorAll('a'));
                    const detailLink = links.find(a => {
                        const linkText = a.innerText?.trim().toLowerCase();
                        const href = a.getAttribute('href') || '';
                        // Look for "Detalle" link near this measure number
                        return linkText === 'detalle' && href.includes('/medidas/');
                    });
                    results.push({
                        numero: numero,
                        url: detailLink ? detailLink.href : `https://sutra.oslpr.org/medidas/${numero}`,
                        fecha: radicada || new Date().toISOString().split('T')[0],
                        titulo: titulo || `Medida ${numero}`,
                        commission: null,
                        author: null
                    });
                });
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
                    }
                    else {
                        results.push(m);
                    }
                    // Politeness delay
                    await new Promise(r => setTimeout(r, 1000));
                }
                catch (e) {
                    this.logger.error(`Failed to scrape details for ${m.numero}`, e);
                    results.push(m);
                }
            }
            return results;
        }
        catch (error) {
            this.logger.error('Failed to scrape SUTRA', error);
            return results;
        }
        finally {
            await page.close();
        }
    }
    async scrapeMeasureDetail(url) {
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
                const clean = (text) => {
                    if (!text)
                        return null;
                    return text.trim().replace(/\s+/g, ' ');
                };
                // Strategy: Try multiple regex patterns for each field
                const findMatch = (patterns) => {
                    for (const p of patterns) {
                        const m = bodyText.match(p);
                        if (m && m[1])
                            return clean(m[1]);
                    }
                    return null;
                };
                const title = findMatch([
                    /Título[:\.]?\s*(.+)(\n|$)/i,
                    /^Título\s*\n(.+)/m // Title on next line
                ]) || 'Título no encontrado';
                const commission = findMatch([
                    /Comisii?ón[:\.]?\s*(.+)(\n|$)/i,
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
        }
        finally {
            await page.close();
        }
    }
    async scrapeCommissionsList() {
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
                        }
                        else {
                            // Strategy 2: Click the button explicitly if ArrowDown didn't work
                            const parent = input.locator('..');
                            const btn = parent.locator('button');
                            if (await btn.count() > 0) {
                                await btn.click();
                                await page.waitForTimeout(500);
                                if (await page.locator('ul[role="listbox"]').isVisible()) {
                                    this.logger.log('Listbox opened via button click');
                                }
                                else {
                                    // Try pressing ArrowDown on the button
                                    await btn.press('ArrowDown');
                                }
                            }
                        }
                    }
                    else {
                        this.logger.warn(`Input with id ${id} not found`);
                    }
                }
                else {
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
                }
                catch (e) {
                    this.logger.warn('Listbox did not appear after interaction attempts.', e);
                }
            }
            else {
                this.logger.warn('Comisiones label not found.');
            }
            return [];
        }
        catch (error) {
            this.logger.error('Failed to scrape commissions list', error);
            return [];
        }
        finally {
            await page.close();
            await context.close();
        }
    }
};
exports.SutraScraper = SutraScraper = SutraScraper_1 = __decorate([
    (0, common_1.Injectable)()
], SutraScraper);
//# sourceMappingURL=sutra.scraper.js.map