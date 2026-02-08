import { Queue, QueueEvents } from 'bullmq';
export declare const ingestQueue: Queue<any, any, string, any, any, string>;
export declare const discoveryQueue: Queue<any, any, string, any, any, string>;
export declare const trackingQueue: Queue<any, any, string, any, any, string>;
export declare const ingestQueueEvents: QueueEvents;
export declare const discoveryQueueEvents: QueueEvents;
export declare const trackingQueueEvents: QueueEvents;
export declare const defaultJobOptions: {
    attempts: number;
    backoff: {
        type: "exponential";
        delay: number;
    };
    removeOnComplete: {
        count: number;
    };
    removeOnFail: {
        count: number;
    };
};
