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

}
