import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

// Existing queues
export const ingestQueue = new Queue('ingest', { connection: connection as any });
export const discoveryQueue = new Queue('discovery', { connection: connection as any });
export const trackingQueue = new Queue('tracking', { connection: connection as any });

// New scraper queues
export const legislatorsQueue = new Queue('legislators-sync', { connection: connection as any });
export const committeesQueue = new Queue('committees-sync', { connection: connection as any });
export const billsQueue = new Queue('bills-ingest', { connection: connection as any });
export const votesQueue = new Queue('votes-sync', { connection: connection as any });
export const billTextQueue = new Queue('bill-text-extract', { connection: connection as any });

export const redisConnection = connection;

// Job options
export const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential' as const,
        delay: 2000,
    },
    removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
        count: 500, // Keep last 500 failed jobs for debugging
    },
};

// Function 16: Contract Analyzer queue (declared after defaultJobOptions to avoid TDZ)
export const contractAnalysisQueue = new Queue('contract-analysis-queue', {
    connection: connection as any,
    defaultJobOptions,
});
