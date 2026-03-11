export interface PipelineResult {
    scraperName: string;
    recordsScraped: number;
    recordsNew: number;
    recordsUpdated: number;
    durationMs: number;
    error?: string;
}

export interface BaseScraper {
    runPipeline(): Promise<PipelineResult>;
}
