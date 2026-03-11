import { Module } from '@nestjs/common';
import { LegislatorsScraper } from './legislators.scraper';
import { ScraperHttpClient } from '../scraper-http.client';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { DatabaseModule } from '../../modules/database/database.module';
import { ChangeEventModule } from '../change-event/change-event.module';

@Module({
    imports: [DatabaseModule, ChangeEventModule],
    providers: [LegislatorsScraper, ScraperHttpClient, ScraperRunRecorder],
    exports: [LegislatorsScraper],
})
export class LegislatorsScraperModule {}
