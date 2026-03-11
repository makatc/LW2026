import { Module } from '@nestjs/common';
import { PipelineModule } from './pipeline/pipeline.module';
import { LegislatorsScraperModule } from './legislators/legislators.module';
import { CommitteesScraperModule } from './committees/committees.module';
import { BillsScraperModule } from './bills/bills.module';
import { VotesScraperModule } from './votes/votes.module';
import { BillTextScraperModule } from './bill-text/bill-text.module';
import { ScraperSchedulerModule } from './scheduler/scraper-scheduler.module';

@Module({
    imports: [
        PipelineModule,
        LegislatorsScraperModule,
        CommitteesScraperModule,
        BillsScraperModule,
        VotesScraperModule,
        BillTextScraperModule,
        ScraperSchedulerModule,
    ],
    exports: [PipelineModule],
})
export class ScrapersModule {}
