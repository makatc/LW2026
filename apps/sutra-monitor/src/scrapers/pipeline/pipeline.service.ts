import { Injectable, Logger } from '@nestjs/common';
import { LegislatorsScraper } from '../legislators/legislators.scraper';
import { CommitteesScraper } from '../committees/committees.scraper';
import { BillsScraper } from '../bills/bills.scraper';
import { VotesScraper } from '../votes/votes.scraper';
import { BillTextScraper } from '../bill-text/bill-text.scraper';
import { PipelineResult } from '../base-scraper';

export interface FullPipelineResult {
    legislators: PipelineResult;
    committees: PipelineResult;
    bills: PipelineResult;
    votes: PipelineResult;
    durationMs: number;
}

@Injectable()
export class PipelineService {
    private readonly logger = new Logger(PipelineService.name);

    constructor(
        private readonly legislatorsScraper: LegislatorsScraper,
        private readonly committeesScraper: CommitteesScraper,
        private readonly billsScraper: BillsScraper,
        private readonly votesScraper: VotesScraper,
        private readonly billTextScraper: BillTextScraper,
    ) {}

    async runFull(): Promise<FullPipelineResult> {
        const startTime = Date.now();
        this.logger.log('Starting full legislative pipeline...');

        // 1. Legislators (must run before committees for name resolution)
        this.logger.log('Step 1/4: Legislators');
        const legislatorsResult = await this.legislatorsScraper.runPipeline();

        // 2. Committees (needs legislator IDs for chair/member resolution)
        this.logger.log('Step 2/4: Committees');
        const committeesResult = await this.committeesScraper.runPipeline();

        // 3. Bills (independent, but runs after for author_id resolution)
        this.logger.log('Step 3/4: Bills');
        const billsResult = await this.billsScraper.runPipeline();

        // 4. Votes (needs bill IDs + legislator IDs)
        this.logger.log('Step 4/4: Votes');
        const votesResult = await this.votesScraper.runPipeline();

        const result: FullPipelineResult = {
            legislators: legislatorsResult,
            committees: committeesResult,
            bills: billsResult,
            votes: votesResult,
            durationMs: Date.now() - startTime,
        };

        this.logger.log(
            `Full pipeline complete in ${result.durationMs}ms: ` +
            `legislators(${legislatorsResult.recordsNew}n/${legislatorsResult.recordsUpdated}u), ` +
            `committees(${committeesResult.recordsNew}n/${committeesResult.recordsUpdated}u), ` +
            `bills(${billsResult.recordsNew}n/${billsResult.recordsUpdated}u), ` +
            `votes(${votesResult.recordsNew}n/${votesResult.recordsUpdated}u)`
        );

        return result;
    }

    async runSingle(scraperName: string): Promise<PipelineResult> {
        this.logger.log(`Running single scraper: ${scraperName}`);

        switch (scraperName) {
            case 'legislators': return this.legislatorsScraper.runPipeline();
            case 'committees': return this.committeesScraper.runPipeline();
            case 'bills': return this.billsScraper.runPipeline();
            case 'votes': return this.votesScraper.runPipeline();
            case 'bill-text': return this.billTextScraper.runPipeline();
            default: throw new Error(`Unknown scraper: ${scraperName}`);
        }
    }
}
