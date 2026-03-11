import { Module } from '@nestjs/common';
import { CommitteesScraper } from './committees.scraper';
import { ScraperHttpClient } from '../scraper-http.client';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { DatabaseModule } from '../../modules/database/database.module';
import { ChangeEventModule } from '../change-event/change-event.module';

@Module({
    imports: [DatabaseModule, ChangeEventModule],
    providers: [CommitteesScraper, ScraperHttpClient, ScraperRunRecorder],
    exports: [CommitteesScraper],
})
export class CommitteesScraperModule {}
