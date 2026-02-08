import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

import { DiscoveryModule } from '../discovery/discovery.module';
import { IngestModule } from '../ingest/ingest.module';

@Module({
    imports: [DiscoveryModule, IngestModule],
    controllers: [HealthController]
})
export class HealthModule { }
