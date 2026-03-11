import { Module } from '@nestjs/common';
import { BillTextScraper } from './bill-text.scraper';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { DatabaseModule } from '../../modules/database/database.module';
import { ChangeEventModule } from '../change-event/change-event.module';

@Module({
    imports: [DatabaseModule, ChangeEventModule],
    providers: [BillTextScraper, ScraperRunRecorder],
    exports: [BillTextScraper],
})
export class BillTextScraperModule {}
