import { Module } from '@nestjs/common';
import { BillsScraper } from './bills.scraper';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { DatabaseModule } from '../../modules/database/database.module';
import { ChangeEventModule } from '../change-event/change-event.module';

@Module({
    imports: [DatabaseModule, ChangeEventModule],
    providers: [BillsScraper, ScraperRunRecorder],
    exports: [BillsScraper],
})
export class BillsScraperModule {}
