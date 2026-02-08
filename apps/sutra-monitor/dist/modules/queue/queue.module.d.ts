import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IngestService } from '../ingest/ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { TrackingService } from '../tracking/tracking.service';
export declare class QueueModule implements OnModuleInit, OnModuleDestroy {
    private readonly ingestService;
    private readonly discoveryService;
    private readonly trackingService;
    private workers;
    constructor(ingestService: IngestService, discoveryService: DiscoveryService, trackingService: TrackingService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
