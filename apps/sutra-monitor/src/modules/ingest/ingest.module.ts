import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { ConfigRepository } from '@lwbeta/db';
import { NotificationModule } from '../notifications/notification.module';
import { ScraperModule } from '../../scraper/scraper.module';

@Module({
    imports: [NotificationModule, ScraperModule],
    providers: [IngestService, ConfigRepository],
    exports: [IngestService],
})
export class IngestModule { }
