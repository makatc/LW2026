import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ApiController } from './api.controller';
import { CommissionController, CommissionService } from './commissions.controller';
import { MonitorConfigModule } from '../config/config.module';
import { SystemRepository } from '@lwbeta/db';
import { NotificationModule } from '../notifications/notification.module';

import { IngestModule } from '../ingest/ingest.module';

@Module({
    imports: [MonitorConfigModule, IngestModule, NotificationModule],
    controllers: [DashboardController, ApiController, CommissionController],
    providers: [CommissionService, SystemRepository],
})
export class ApiModule { }
