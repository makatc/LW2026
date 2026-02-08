import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ScrapedMeasure } from '../types';
export declare class SutraScraper implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private browser;
    onModuleInit(): Promise<void>;
    private ensureBrowser;
    onModuleDestroy(): Promise<void>;
    scrapeLatest(): Promise<ScrapedMeasure[]>;
    private scrapeMeasureDetail;
    scrapeCommissionsList(): Promise<string[]>;
}
