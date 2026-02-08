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
