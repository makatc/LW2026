import { Worker } from 'bullmq';
export declare const createIngestWorker: (ingestService: any) => Worker<any, any, string>;
export declare const createDiscoveryWorker: (discoveryService: any) => Worker<any, any, string>;
export declare const createTrackingWorker: (trackingService: any) => Worker<any, any, string>;
