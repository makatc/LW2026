import { Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
    ingestQueue, discoveryQueue, trackingQueue,
    legislatorsQueue, committeesQueue, billsQueue, votesQueue, billTextQueue,
    contractAnalysisQueue,
} from '../../queues';
import {
    createIngestWorker, createDiscoveryWorker, createTrackingWorker,
    createLegislatorsWorker, createCommitteesWorker, createBillsWorker,
    createVotesWorker, createBillTextWorker,
    createContractAnalysisWorker,
} from '../../queues/workers';
import { IngestModule } from '../ingest/ingest.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ActiveTrackingModule } from '../tracking/tracking.module';
import { IngestService } from '../ingest/ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { TrackingService } from '../tracking/tracking.service';
import { PipelineModule } from '../../scrapers/pipeline/pipeline.module';
import { PipelineService } from '../../scrapers/pipeline/pipeline.service';
import { ContractAnalyzerModule } from '../contract-analyzer/contract-analyzer.module';
import { ContractAnalyzerService } from '../contract-analyzer/contract-analyzer.service';
import { Worker } from 'bullmq';

@Module({
    imports: [IngestModule, DiscoveryModule, ActiveTrackingModule, PipelineModule, ContractAnalyzerModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(QueueModule.name);
    private workers: Worker[] = [];

    constructor(
        private readonly ingestService: IngestService,
        private readonly discoveryService: DiscoveryService,
        private readonly trackingService: TrackingService,
        private readonly pipelineService: PipelineService,
        private readonly contractAnalyzerService: ContractAnalyzerService,
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

            // Function 16: Contract Analyzer worker
            this.workers.push(createContractAnalysisWorker(this.contractAnalyzerService));

            // Clear any previously scheduled repeatable jobs
            const queues = [
                ingestQueue, discoveryQueue, trackingQueue,
                legislatorsQueue, committeesQueue, billsQueue, votesQueue, billTextQueue,
                contractAnalysisQueue,
            ];
            for (const q of queues) {
                const repeatableJobs = await q.getRepeatableJobs();
                for (const job of repeatableJobs) {
                    await q.removeRepeatableByKey(job.key);
                }
            }

            this.logger.log('✅ BullMQ workers started. Automatic scraping on boot is disabled.');
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
