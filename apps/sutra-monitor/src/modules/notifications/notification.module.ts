import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MonitorConfigModule } from '../config/config.module';

@Module({
    imports: [MonitorConfigModule],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule { }
