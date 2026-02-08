import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// Queues
export const ingestQueue = new Queue('ingest', { connection });
export const discoveryQueue = new Queue('discovery', { connection });
export const trackingQueue = new Queue('tracking', { connection });

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
