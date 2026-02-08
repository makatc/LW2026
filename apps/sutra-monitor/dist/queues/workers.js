"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrackingWorker = exports.createDiscoveryWorker = exports.createIngestWorker = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const common_1 = require("@nestjs/common");
const connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});
const logger = new common_1.Logger('IngestWorker');
const createIngestWorker = (ingestService) => {
    return new bullmq_1.Worker('ingest', async (job) => {
        logger.log(`Processing ingest job ${job.id}`);
        try {
            await ingestService.runIngestion();
            logger.log(`Ingest job ${job.id} completed successfully`);
            return { success: true };
        }
        catch (error) {
            logger.error(`Ingest job ${job.id} failed:`, error);
            throw error;
        }
    }, {
        connection,
        concurrency: 1,
        limiter: {
            max: 10,
            duration: 60000, // per minute
        },
    });
};
exports.createIngestWorker = createIngestWorker;
const createDiscoveryWorker = (discoveryService) => {
    return new bullmq_1.Worker('discovery', async (job) => {
        logger.log(`Processing discovery job ${job.id}`);
        try {
            await discoveryService.runDiscoveryJob();
            logger.log(`Discovery job ${job.id} completed successfully`);
            return { success: true };
        }
        catch (error) {
            logger.error(`Discovery job ${job.id} failed:`, error);
            throw error;
        }
    }, {
        connection,
        concurrency: 1,
    });
};
exports.createDiscoveryWorker = createDiscoveryWorker;
const createTrackingWorker = (trackingService) => {
    return new bullmq_1.Worker('tracking', async (job) => {
        logger.log(`Processing tracking job ${job.id}`);
        try {
            await trackingService.runTrackingJob();
            logger.log(`Tracking job ${job.id} completed successfully`);
            return { success: true };
        }
        catch (error) {
            logger.error(`Tracking job ${job.id} failed:`, error);
            throw error;
        }
    }, {
        connection,
        concurrency: 2, // Can process 2 tracking jobs in parallel
    });
};
exports.createTrackingWorker = createTrackingWorker;
//# sourceMappingURL=workers.js.map