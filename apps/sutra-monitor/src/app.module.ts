import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { IngestModule } from './modules/ingest/ingest.module';
import { MonitorConfigModule } from './modules/config/config.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ActiveTrackingModule } from './modules/tracking/tracking.module';
import { ApiModule } from './modules/api/api.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { DatabaseMigrationService } from './database-migration.service';
import { ScrapersModule } from './scrapers/scrapers.module';
import { CoalitionsModule } from './modules/coalitions/coalitions.module';
import { AiSummariesModule } from './modules/ai-summaries/ai-summaries.module';
import { BrandTemplatesModule } from './modules/brand-templates/brand-templates.module';
import { PredictiveAnalysisModule } from './modules/predictive-analysis/predictive-analysis.module';
import { ExecutiveRadarModule } from './modules/executive-radar/executive-radar.module';
import { ContractAnalyzerModule } from './modules/contract-analyzer/contract-analyzer.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ScheduleModule.forRoot(),
        AuthModule,
        IngestModule,
        MonitorConfigModule,
        DiscoveryModule,
        ActiveTrackingModule,
        ApiModule,
        DatabaseModule,
        HealthModule,
        QueueModule,
        ScrapersModule,
        CoalitionsModule,
        AiSummariesModule,
        BrandTemplatesModule,
        PredictiveAnalysisModule,
        ExecutiveRadarModule,
        ContractAnalyzerModule,
    ],
    controllers: [],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        DatabaseMigrationService,
    ],
})
export class AppModule { }
