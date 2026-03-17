import { Controller, Get, Post, Put, Body, Param, BadRequestException } from '@nestjs/common';
import { pool } from '@lwbeta/db';
import { Public } from '../../auth/decorators';
import { PipelineService } from '../../../scrapers/pipeline/pipeline.service';
import { ScraperRunRecorder } from '../../../scrapers/scraper-run.recorder';
import { FiscalScraperSchedulerService } from '../../../scrapers/fiscal-intelligence/fiscal-scraper-scheduler.service';
import {
    legislatorsQueue, committeesQueue, billsQueue, votesQueue, billTextQueue, defaultJobOptions,
} from '../../../queues';

const VALID_SCRAPERS = ['legislators', 'committees', 'bills', 'votes', 'bill-text', 'ogp', 'hacienda', 'fomb', 'all'];

@Controller('api/scraper')
export class ScraperController {
    constructor(
        private readonly pipelineService: PipelineService,
        private readonly recorder: ScraperRunRecorder,
        private readonly fiscalScheduler: FiscalScraperSchedulerService,
    ) {}

    @Post('trigger')
    @Public()
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
            this.fiscalScheduler.runOgpScraper().catch(() => {});
            this.fiscalScheduler.runHaciendaScraper().catch(() => {});
            this.fiscalScheduler.runFombScraper().catch(() => {});
            return { message: 'All scrapers queued/started', scrapers: VALID_SCRAPERS.filter(s => s !== 'all') };
        }

        // Fiscal intelligence scrapers (no BullMQ — fire and forget)
        const fiscalTriggerMap: Record<string, () => Promise<void>> = {
            ogp: () => this.fiscalScheduler.runOgpScraper(),
            hacienda: () => this.fiscalScheduler.runHaciendaScraper(),
            fomb: () => this.fiscalScheduler.runFombScraper(),
        };
        if (fiscalTriggerMap[scraperName]) {
            fiscalTriggerMap[scraperName]().catch(() => {});
            return { message: `${scraperName} scraper started`, scraper: scraperName };
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

    @Get('config')
    @Public()
    async getConfigs() {
        const result = await pool.query('SELECT * FROM scraper_configs ORDER BY id ASC');
        return result.rows;
    }

    @Put('config/:id')
    @Public()
    async updateConfig(
        @Param('id') id: string,
        @Body() body: { is_enabled: boolean; cron_expression?: string }
    ) {
        if (!VALID_SCRAPERS.includes(id) && id !== 'all') {
            throw new BadRequestException(`Invalid scraper id: ${id}`);
        }

        const queueMap: Record<string, any> = {
            legislators: legislatorsQueue,
            committees: committeesQueue,
            bills: billsQueue,
            votes: votesQueue,
            'bill-text': billTextQueue,
        };

        const queue = queueMap[id];
        
        await pool.query(
            `UPDATE scraper_configs 
             SET is_enabled = $1, cron_expression = COALESCE($2, cron_expression), updated_at = NOW()
             WHERE id = $3`,
            [body.is_enabled, body.cron_expression, id]
        );

        if (queue) {
            // First, remove existing repeatable jobs
            const repeatableJobs = await queue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                if (job.name === `scheduled-${id}`) {
                    await queue.removeRepeatableByKey(job.key);
                }
            }

            // Schedule if enabled
            if (body.is_enabled) {
                const result = await pool.query('SELECT cron_expression FROM scraper_configs WHERE id = $1', [id]);
                const cron = result.rows[0]?.cron_expression;
                if (cron) {
                    await queue.add(`scheduled-${id}`, {}, {
                        ...defaultJobOptions,
                        repeat: { pattern: cron }
                    });
                }
            }
        }

        return { message: 'Configuration updated successfully' };
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
