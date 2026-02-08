"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SutraClient = void 0;
const common_1 = require("@nestjs/common");
const playwright_1 = require("playwright");
const utils_1 = require("@lwbeta/utils");
let SutraClient = exports.SutraClient = class SutraClient {
    constructor() {
        this.browser = null;
        this.BASE_URL = 'https://sutra.oslpr.org';
    }
    async onModuleInit() {
        // Lazy launch or keep warm - usually better to launch per job for stability
        // but initializing the browser instance reused for multiple pages is faster.
        // For now, we will handle browser lifecycle in the methods or reused if robust.
        utils_1.logger.info('SutraClient initialized');
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
        }
    }
    async getBrowser() {
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await playwright_1.chromium.launch({
                headless: true, // Set to false for debugging
            });
        }
        return this.browser;
    }
    async listSubmittedUpdates() {
        utils_1.logger.info('Starting scrape: listSubmittedUpdates');
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        const results = [];
        try {
            // Navigate to main query page - adjusting URL based on known entry points
            // Assuming there is a "Tramite Legislativo" or similar section. 
            // Since I cannot browse in real-time without the tool, I will implement resilient 
            // locators based on typical SUTRA layouts (tables with classes like 'medida', 'tramite').
            // NOTE: This URL is illustrative. Real navigation often requires clicking "Buscar"
            await page.goto(`${this.BASE_URL}/osl/medidas/buscar`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            // SIMULATION MODE for "Happy Path" until real DOM is inspected
            // In a real scenario, we would fill form, search, paginate.
            utils_1.logger.info('Navigated to search page');
            // Attempt to extract data using hypothetical selectors
            // Fallback to "Recent Updates" if direct search isn't simple GET
            // Mocking extraction logic for demonstration of the architecture
            // The real implementation requires `read_url` or `read_browser_page` to Reverse Engineer the DOM.
            // I will implement the robust scaffolding now.
            // Example scraper logic:
            // const rows = page.locator('table.resultados tr');
            // ... iterate and push to results
        }
        catch (error) {
            utils_1.logger.error({ err: error }, 'Error scraping SUTRA');
            throw error;
        }
        finally {
            await page.close();
        }
        return results;
    }
    async fetchMeasureDetail(url) {
        // Mock implementation until we have real DOM access
        utils_1.logger.info({ url }, 'Fetching measure detail');
        // In real implementation: calculate hash of the detail page content
        return {
            title: 'Mock Title',
            status: 'En Trámite',
            contentHash: 'mock-hash-' + Date.now()
        };
    }
    async fetchMeasureTimelineEvents(url) {
        // Mock implementation
        utils_1.logger.info({ url }, 'Fetching timeline events');
        return [
            {
                eventType: 'VISTA_PUBLICA',
                title: 'Vista Pública 1',
                date: '2026-02-10',
                hash: 'event-hash-1'
            }
        ];
    }
    // Helper to parse dates from format "DD/MM/YYYY"
    parseDate(dateStr) {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
};
exports.SutraClient = SutraClient = __decorate([
    (0, common_1.Injectable)()
], SutraClient);
//# sourceMappingURL=sutra-client.js.map