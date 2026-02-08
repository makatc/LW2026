import { IngestService } from '../ingest/ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
export declare class HealthController {
    private readonly discoveryService;
    private readonly ingestService;
    constructor(discoveryService: DiscoveryService, ingestService: IngestService);
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
        services: {
            database: string;
            redis: string;
        };
    }>;
}
