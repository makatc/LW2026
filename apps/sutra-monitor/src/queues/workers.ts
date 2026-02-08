import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

const logger = new Logger('IngestWorker');

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
            connection,
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
            connection,
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
            connection,
            concurrency: 2, // Can process 2 tracking jobs in parallel
        }
    );
};
