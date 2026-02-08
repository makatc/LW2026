import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { logger, normalizeText, calculateHash } from '@lwbeta/utils';

export interface ScrapedMeasure {
    numero: string;
    titulo: string;
    extracto: string;
    comision: string;
    fecha: string; // Raw string date
    url: string;
    hash: string;
}

@Injectable()
export class SutraClient implements OnModuleInit, OnModuleDestroy {
    private browser: Browser | null = null;
    private readonly BASE_URL = 'https://sutra.oslpr.org';

    async onModuleInit() {
        // Lazy launch or keep warm - usually better to launch per job for stability
        // but initializing the browser instance reused for multiple pages is faster.
        // For now, we will handle browser lifecycle in the methods or reused if robust.
        logger.info('SutraClient initialized');
    }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    private async getBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await chromium.launch({
                headless: true, // Set to false for debugging
            });
        }
        return this.browser;
    }

    async listSubmittedUpdates(): Promise<ScrapedMeasure[]> {
        logger.info('Starting scrape: listSubmittedUpdates');
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        const results: ScrapedMeasure[] = [];

        try {
            // Navigate to main query page - adjusting URL based on known entry points
            // Assuming there is a "Tramite Legislativo" or similar section. 
            // Since I cannot browse in real-time without the tool, I will implement resilient 
            // locators based on typical SUTRA layouts (tables with classes like 'medida', 'tramite').

            // NOTE: This URL is illustrative. Real navigation often requires clicking "Buscar"
            await page.goto(`${this.BASE_URL}/osl/medidas/buscar`, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // SIMULATION MODE for "Happy Path" until real DOM is inspected
            // In a real scenario, we would fill form, search, paginate.
            logger.info('Navigated to search page');

            // Attempt to extract data using hypothetical selectors
            // Fallback to "Recent Updates" if direct search isn't simple GET

            // Mocking extraction logic for demonstration of the architecture
            // The real implementation requires `read_url` or `read_browser_page` to Reverse Engineer the DOM.
            // I will implement the robust scaffolding now.

            // Example scraper logic:
            // const rows = page.locator('table.resultados tr');
            // ... iterate and push to results

        } catch (error) {
            logger.error({ err: error }, 'Error scraping SUTRA');
            throw error;
        } finally {
            await page.close();
        }

        return results;
    }


    async fetchMeasureDetail(url: string): Promise<any> {
        // Mock implementation until we have real DOM access
        logger.info({ url }, 'Fetching measure detail');
        // In real implementation: calculate hash of the detail page content
        return {
            title: 'Mock Title',
            status: 'En Trámite',
            contentHash: 'mock-hash-' + Date.now()
        };
    }

    async fetchMeasureTimelineEvents(url: string): Promise<any[]> {
        // Mock implementation
        logger.info({ url }, 'Fetching timeline events');
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
    parseDate(dateStr: string): Date {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
}
