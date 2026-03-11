import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

const redisUrl = process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

const logger = new Logger('ScraperWorkers');

export const createIngestWorker = (ingestService: any) => {
    return new Worker(
        'ingest',
        async (job) => {
            logger.log(`Processing ingest job ${job.id}`);

            try {
                await ingestService.runIngestion();
                logger.log(`Ingest job ${job.id} completed successfully`);
                return { success: true };
            } catch (error: any) {
                logger.error(`Ingest job ${job.id} failed:`, error);
                throw error;
            }
        },
        {
            connection: connection as any,
            concurrency: 1, // Process one job at a time
            limiter: {
                max: 10, // Max 10 jobs
                duration: 60000, // per minute
            },
        }
    );
};

export const createDiscoveryWorker = (discoveryService: any) => {
    return new Worker(
        'discovery',
        async (job) => {
            logger.log(`Processing discovery job ${job.id}`);

            try {
                await discoveryService.runDiscoveryJob();
                logger.log(`Discovery job ${job.id} completed successfully`);
                return { success: true };
            } catch (error: any) {
                logger.error(`Discovery job ${job.id} failed:`, error);
                throw error;
            }
        },
        {
            connection: connection as any,
            concurrency: 1,
        }
    );
};

export const createTrackingWorker = (trackingService: any) => {
    return new Worker(
        'tracking',
        async (job) => {
            logger.log(`Processing tracking job ${job.id}`);

            try {
                await trackingService.runTrackingJob();
                logger.log(`Tracking job ${job.id} completed successfully`);
                return { success: true };
            } catch (error: any) {
                logger.error(`Tracking job ${job.id} failed:`, error);
                throw error;
            }
        },
        {
            connection: connection as any,
            concurrency: 2, // Can process 2 tracking jobs in parallel
        }
    );
};

// ─── New scraper workers ────────────────────────────────────────────────────

export const createLegislatorsWorker = (pipelineService: any) => {
    return new Worker(
        'legislators-sync',
        async (job) => {
            logger.log(`Processing legislators-sync job ${job.id}`);
            try {
                const result = await pipelineService.runSingle('legislators');
                logger.log(`legislators-sync job ${job.id} complete: ${result.recordsNew}n/${result.recordsUpdated}u`);
                return result;
            } catch (error: any) {
                logger.error(`legislators-sync job ${job.id} failed:`, error);
                throw error;
            }
        },
        { connection: connection as any, concurrency: 1 }
    );
};

export const createCommitteesWorker = (pipelineService: any) => {
    return new Worker(
        'committees-sync',
        async (job) => {
            logger.log(`Processing committees-sync job ${job.id}`);
            try {
                const result = await pipelineService.runSingle('committees');
                logger.log(`committees-sync job ${job.id} complete: ${result.recordsNew}n/${result.recordsUpdated}u`);
                return result;
            } catch (error: any) {
                logger.error(`committees-sync job ${job.id} failed:`, error);
                throw error;
            }
        },
        { connection: connection as any, concurrency: 1 }
    );
};

export const createBillsWorker = (pipelineService: any) => {
    return new Worker(
        'bills-ingest',
        async (job) => {
            logger.log(`Processing bills-ingest job ${job.id}`);
            try {
                const result = await pipelineService.runSingle('bills');
                logger.log(`bills-ingest job ${job.id} complete: ${result.recordsNew}n/${result.recordsUpdated}u`);
                return result;
            } catch (error: any) {
                logger.error(`bills-ingest job ${job.id} failed:`, error);
                throw error;
            }
        },
        { connection: connection as any, concurrency: 1 }
    );
};

export const createVotesWorker = (pipelineService: any) => {
    return new Worker(
        'votes-sync',
        async (job) => {
            logger.log(`Processing votes-sync job ${job.id}`);
            try {
                const result = await pipelineService.runSingle('votes');
                logger.log(`votes-sync job ${job.id} complete: ${result.recordsNew}n/${result.recordsUpdated}u`);
                return result;
            } catch (error: any) {
                logger.error(`votes-sync job ${job.id} failed:`, error);
                throw error;
            }
        },
        { connection: connection as any, concurrency: 1 }
    );
};

export const createBillTextWorker = (pipelineService: any) => {
    return new Worker(
        'bill-text-extract',
        async (job) => {
            logger.log(`Processing bill-text-extract job ${job.id}`);
            try {
                const result = await pipelineService.runSingle('bill-text');
                logger.log(`bill-text-extract job ${job.id} complete: ${result.recordsNew}n/${result.recordsUpdated}u`);
                return result;
            } catch (error: any) {
                logger.error(`bill-text-extract job ${job.id} failed:`, error);
                throw error;
            }
        },
        { connection: connection as any, concurrency: 1 }
    );
};
