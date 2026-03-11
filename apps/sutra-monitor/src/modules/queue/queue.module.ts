import { Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
    ingestQueue, discoveryQueue, trackingQueue,
    legislatorsQueue, committeesQueue, billsQueue, votesQueue, billTextQueue,
    defaultJobOptions,
} from '../../queues';
import {
    createIngestWorker, createDiscoveryWorker, createTrackingWorker,
    createLegislatorsWorker, createCommitteesWorker, createBillsWorker,
    createVotesWorker, createBillTextWorker,
} from '../../queues/workers';
import { IngestModule } from '../ingest/ingest.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ActiveTrackingModule } from '../tracking/tracking.module';
import { IngestService } from '../ingest/ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { TrackingService } from '../tracking/tracking.service';
import { PipelineModule } from '../../scrapers/pipeline/pipeline.module';
import { PipelineService } from '../../scrapers/pipeline/pipeline.service';
import { Worker } from 'bullmq';

@Module({
    imports: [IngestModule, DiscoveryModule, ActiveTrackingModule, PipelineModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(QueueModule.name);
    private workers: Worker[] = [];

    constructor(
        private readonly ingestService: IngestService,
        private readonly discoveryService: DiscoveryService,
        private readonly trackingService: TrackingService,
        private readonly pipelineService: PipelineService,
    ) {}

    async onModuleInit() {
        try {
            // Existing workers
            this.workers.push(createIngestWorker(this.ingestService));
            this.workers.push(createDiscoveryWorker(this.discoveryService));
            this.workers.push(createTrackingWorker(this.trackingService));

            // New scraper workers
            this.workers.push(createLegislatorsWorker(this.pipelineService));
            this.workers.push(createCommitteesWorker(this.pipelineService));
            this.workers.push(createBillsWorker(this.pipelineService));
            this.workers.push(createVotesWorker(this.pipelineService));
            this.workers.push(createBillTextWorker(this.pipelineService));

            // Schedule existing jobs
            await ingestQueue.add('scheduled-ingest', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 */6 * * *' },
            });
            await discoveryQueue.add('scheduled-discovery', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 */12 * * *' },
            });
            await trackingQueue.add('scheduled-tracking', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 */4 * * *' },
            });

            // Schedule new scraper jobs
            await legislatorsQueue.add('scheduled-legislators', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 6 * * *' }, // Daily at 6 AM
            });
            await committeesQueue.add('scheduled-committees', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '30 6 * * *' }, // Daily at 6:30 AM
            });
            await billsQueue.add('scheduled-bills', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 */2 * * *' }, // Every 2 hours
            });
            await votesQueue.add('scheduled-votes', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 */4 * * *' }, // Every 4 hours
            });
            await billTextQueue.add('scheduled-bill-text', {}, {
                ...defaultJobOptions,
                repeat: { pattern: '0 2 * * *' }, // Daily at 2 AM
            });

            this.logger.log('✅ BullMQ workers started and jobs scheduled (8 workers)');
        } catch (error: any) {
            this.logger.error('Failed to initialize BullMQ workers:', error.message);
            this.logger.warn('App will continue in cron-only mode');
        }
    }

    async onModuleDestroy() {
        await Promise.all(this.workers.map(w => w.close()));
        this.logger.log('✅ BullMQ workers closed');
    }
}
