import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ingestQueue, discoveryQueue, trackingQueue, defaultJobOptions } from '../../queues';
import { createIngestWorker, createDiscoveryWorker, createTrackingWorker } from '../../queues/workers';
import { IngestModule } from '../ingest/ingest.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ActiveTrackingModule } from '../tracking/tracking.module';
import { IngestService } from '../ingest/ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { TrackingService } from '../tracking/tracking.service';
import { Worker } from 'bullmq';

@Module({
    imports: [IngestModule, DiscoveryModule, ActiveTrackingModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
    private workers: Worker[] = [];

    constructor(
        private readonly ingestService: IngestService,
        private readonly discoveryService: DiscoveryService,
        private readonly trackingService: TrackingService,
    ) { }

    async onModuleInit() {
        // Create workers
        this.workers.push(createIngestWorker(this.ingestService));
        this.workers.push(createDiscoveryWorker(this.discoveryService));
        this.workers.push(createTrackingWorker(this.trackingService));

        // Schedule recurring jobs
        await ingestQueue.add(
            'scheduled-ingest',
            {},
            {
                ...defaultJobOptions,
                repeat: {
                    pattern: '0 */6 * * *', // Every 6 hours
                },
            }
        );

        await discoveryQueue.add(
            'scheduled-discovery',
            {},
            {
                ...defaultJobOptions,
                repeat: {
                    pattern: '0 */12 * * *', // Every 12 hours
                },
            }
        );

        await trackingQueue.add(
            'scheduled-tracking',
            {},
            {
                ...defaultJobOptions,
                repeat: {
                    pattern: '0 */4 * * *', // Every 4 hours
                },
            }
        );

        console.log('✅ BullMQ workers started and jobs scheduled');
    }

    async onModuleDestroy() {
        // Gracefully close all workers
        await Promise.all(this.workers.map(w => w.close()));
        console.log('✅ BullMQ workers closed');
    }
}
