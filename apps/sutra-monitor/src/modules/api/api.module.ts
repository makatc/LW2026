import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ApiController } from './api.controller';
import { CommissionController, CommissionService } from './commissions.controller';
import { MonitorConfigModule } from '../config/config.module';
import { SystemRepository } from '@lwbeta/db';
import { NotificationModule } from '../notifications/notification.module';
import { IngestModule } from '../ingest/ingest.module';

// New API modules
import { LegislatorsApiModule } from './legislators/legislators.module';
import { CommitteesApiModule } from './committees/committees.module';
import { BillsApiModule } from './bills/bills.module';
import { VotesApiModule } from './votes/votes.module';
import { ScraperApiModule } from './scraper/scraper.module';
import { ChangeEventsApiModule } from './change-events/change-events.module';
import { InteractionsApiModule } from './interactions/interactions.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { ComplianceModule } from './compliance/compliance.module';
import { DojRegistryModule } from './doj-registry/doj-registry.module';

@Module({
    imports: [
        MonitorConfigModule,
        IngestModule,
        NotificationModule,
        LegislatorsApiModule,
        CommitteesApiModule,
        BillsApiModule,
        VotesApiModule,
        ScraperApiModule,
        ChangeEventsApiModule,
        InteractionsApiModule,
        IntelligenceModule,
        ComplianceModule,
        DojRegistryModule,
    ],
    controllers: [DashboardController, ApiController, CommissionController],
    providers: [CommissionService, SystemRepository],
})
export class ApiModule { }
