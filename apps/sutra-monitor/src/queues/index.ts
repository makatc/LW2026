import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// Queues
export const ingestQueue = new Queue('ingest', { connection: connection as any });
export const discoveryQueue = new Queue('discovery', { connection: connection as any });
export const trackingQueue = new Queue('tracking', { connection: connection as any });

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
