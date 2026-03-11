import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { LegislatorsScraperModule } from '../legislators/legislators.module';
import { CommitteesScraperModule } from '../committees/committees.module';
import { BillsScraperModule } from '../bills/bills.module';
import { VotesScraperModule } from '../votes/votes.module';
import { BillTextScraperModule } from '../bill-text/bill-text.module';

@Module({
    imports: [
        LegislatorsScraperModule,
        CommitteesScraperModule,
        BillsScraperModule,
        VotesScraperModule,
        BillTextScraperModule,
    ],
    providers: [PipelineService],
    exports: [PipelineService],
})
export class PipelineModule {}
