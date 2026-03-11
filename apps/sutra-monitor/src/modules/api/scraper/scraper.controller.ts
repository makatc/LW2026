import { Controller, Get, Post, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { Roles, Public } from '../../auth/decorators';
import { RolesGuard } from '../../auth/roles.guard';
import { PipelineService } from '../../../scrapers/pipeline/pipeline.service';
import { ScraperRunRecorder } from '../../../scrapers/scraper-run.recorder';
import {
    legislatorsQueue, committeesQueue, billsQueue, votesQueue, billTextQueue, defaultJobOptions,
} from '../../../queues';

const VALID_SCRAPERS = ['legislators', 'committees', 'bills', 'votes', 'bill-text', 'all'];

@Controller('api/scraper')
export class ScraperController {
    constructor(
        private readonly pipelineService: PipelineService,
        private readonly recorder: ScraperRunRecorder,
    ) {}

    @Post('trigger')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async trigger(@Body() body: { scraper: string }) {
        const scraperName = body?.scraper;

        if (!scraperName || !VALID_SCRAPERS.includes(scraperName)) {
            throw new BadRequestException(
                `Invalid scraper. Valid options: ${VALID_SCRAPERS.join(', ')}`
            );
        }

        if (scraperName === 'all') {
            await legislatorsQueue.add('manual-trigger', {}, defaultJobOptions);
            await committeesQueue.add('manual-trigger', {}, defaultJobOptions);
            await billsQueue.add('manual-trigger', {}, defaultJobOptions);
            await votesQueue.add('manual-trigger', {}, defaultJobOptions);
            await billTextQueue.add('manual-trigger', {}, defaultJobOptions);
            return { message: 'All scrapers queued', scrapers: VALID_SCRAPERS.filter(s => s !== 'all') };
        }

        const queueMap: Record<string, any> = {
            legislators: legislatorsQueue,
            committees: committeesQueue,
            bills: billsQueue,
            votes: votesQueue,
            'bill-text': billTextQueue,
        };

        const queue = queueMap[scraperName];
        if (queue) {
            await queue.add('manual-trigger', {}, defaultJobOptions);
            return { message: `${scraperName} scraper queued`, scraper: scraperName };
        }

        throw new BadRequestException(`Unknown scraper: ${scraperName}`);
    }

    @Get('status')
    @Public()
    async getStatus() {
        const queues = [
            { name: 'legislators-sync', queue: legislatorsQueue },
            { name: 'committees-sync', queue: committeesQueue },
            { name: 'bills-ingest', queue: billsQueue },
            { name: 'votes-sync', queue: votesQueue },
            { name: 'bill-text-extract', queue: billTextQueue },
        ];

        const status: Record<string, any> = {};
        for (const { name, queue } of queues) {
            try {
                status[name] = await queue.getJobCounts('active', 'waiting', 'completed', 'failed');
            } catch {
                status[name] = { error: 'Queue unavailable' };
            }
        }

        const recentRuns = await this.recorder.getRecentRuns(20);
        return { queues: status, recent_runs: recentRuns };
    }
}
