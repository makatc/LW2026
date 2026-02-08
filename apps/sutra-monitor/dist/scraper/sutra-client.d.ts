import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export interface ScrapedMeasure {
    numero: string;
    titulo: string;
    extracto: string;
    comision: string;
    fecha: string;
    url: string;
    hash: string;
}
export declare class SutraClient implements OnModuleInit, OnModuleDestroy {
    private browser;
    private readonly BASE_URL;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private getBrowser;
    listSubmittedUpdates(): Promise<ScrapedMeasure[]>;
    fetchMeasureDetail(url: string): Promise<any>;
    fetchMeasureTimelineEvents(url: string): Promise<any[]>;
    parseDate(dateStr: string): Date;
}
