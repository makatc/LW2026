import { Module } from '@nestjs/common';
import { VotesScraper } from './votes.scraper';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { DatabaseModule } from '../../modules/database/database.module';
import { ChangeEventModule } from '../change-event/change-event.module';

@Module({
    imports: [DatabaseModule, ChangeEventModule],
    providers: [VotesScraper, ScraperRunRecorder],
    exports: [VotesScraper],
})
export class VotesScraperModule {}
