"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultJobOptions = exports.trackingQueueEvents = exports.discoveryQueueEvents = exports.ingestQueueEvents = exports.trackingQueue = exports.discoveryQueue = exports.ingestQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});
// Queues
exports.ingestQueue = new bullmq_1.Queue('ingest', { connection });
exports.discoveryQueue = new bullmq_1.Queue('discovery', { connection });
exports.trackingQueue = new bullmq_1.Queue('tracking', { connection });
// Queue Events for monitoring
exports.ingestQueueEvents = new bullmq_1.QueueEvents('ingest', { connection });
exports.discoveryQueueEvents = new bullmq_1.QueueEvents('discovery', { connection });
exports.trackingQueueEvents = new bullmq_1.QueueEvents('tracking', { connection });
// Job options
exports.defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
    removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
        count: 500, // Keep last 500 failed jobs for debugging
    },
};
//# sourceMappingURL=index.js.map