import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class ScraperHttpClient {
    private readonly logger = new Logger(ScraperHttpClient.name);
    private readonly client: AxiosInstance;
    private readonly rateLimitMs: number;

    constructor() {
        this.rateLimitMs = parseInt(process.env.SCRAPER_RATE_LIMIT_MS || '2000', 10);
        this.client = axios.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-PR,es;q=0.9,en;q=0.8',
            },
        });
    }

    async getHtml(url: string): Promise<cheerio.CheerioAPI> {
        const response = await this.fetchWithRetry(url);
        return cheerio.load(response);
    }

    async getRaw(url: string): Promise<string> {
        return this.fetchWithRetry(url);
    }

    async getBuffer(url: string): Promise<Buffer> {
        const response = await this.client.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }

    private async fetchWithRetry(url: string, retries = 3): Promise<string> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.sleep(this.rateLimitMs);
                const response = await this.client.get(url);
                return response.data;
            } catch (error: any) {
                const status = error?.response?.status;
                this.logger.warn(`Attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);

                if (status === 404) throw error; // Don't retry 404s
                if (attempt === retries) throw error;

                // Exponential backoff
                await this.sleep(this.rateLimitMs * Math.pow(2, attempt));
            }
        }
        throw new Error(`All retries exhausted for ${url}`);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
