import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { MonitorConfigModule } from '../config/config.module';
import { MeasureRepository, SystemRepository } from '@lwbeta/db';
import { NotificationModule } from '../notifications/notification.module';

@Module({
    imports: [MonitorConfigModule, NotificationModule],
    providers: [DiscoveryService, MeasureRepository, SystemRepository],
    exports: [DiscoveryService],
})
export class DiscoveryModule { }
