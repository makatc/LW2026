import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PipelineService } from '../pipeline/pipeline.service';

/**
 * ScraperSchedulerService
 *
 * Cron-based fallback scheduler for all scrapers.
 * Runs when SCRAPER_CRON_ENABLED=true (default: true when REDIS_URL is not set).
 *
 * When BullMQ is available (Redis is up), the QueueModule's repeatable jobs
 * handle scheduling. This service provides a reliable fallback for environments
 * where Redis is unavailable (dev, staging without Redis, etc.).
 *
 * Schedules (mirroring QueueModule's BullMQ patterns):
 *   legislators : daily   06:00
 *   committees  : daily   06:30
 *   bills       : every 2 hours (on the hour)
 *   votes       : every 4 hours
 *   bill-text   : daily   02:00
 */
@Injectable()
export class ScraperSchedulerService {
    private readonly logger = new Logger(ScraperSchedulerService.name);

    /** True when this cron fallback should run */
    private readonly enabled: boolean;

    /** Guard against concurrent pipeline runs */
    private running = false;

    constructor(private readonly pipeline: PipelineService) {
        // Disabled completely in favor of Database-driven dynamic BullMQ scheduler
        this.enabled = false;

        this.logger.log('⏸  Cron scheduler DISABLED (BullMQ handles scheduling dynamically)');
    }

    // ─── Legislators: daily 06:00 ─────────────────────────────────────────────

    @Cron('0 6 * * *', { name: 'legislators-cron' })
    async runLegislators() {
        if (!this.enabled) return;
        await this.runSingle('legislators');
    }

    // ─── Committees: daily 06:30 ──────────────────────────────────────────────

    @Cron('30 6 * * *', { name: 'committees-cron' })
    async runCommittees() {
        if (!this.enabled) return;
        await this.runSingle('committees');
    }

    // ─── Bills: every 2 hours ─────────────────────────────────────────────────

    @Cron('0 */2 * * *', { name: 'bills-cron' })
    async runBills() {
        if (!this.enabled) return;
        await this.runSingle('bills');
    }

    // ─── Votes: every 4 hours ─────────────────────────────────────────────────

    @Cron('0 */4 * * *', { name: 'votes-cron' })
    async runVotes() {
        if (!this.enabled) return;
        await this.runSingle('votes');
    }

    // ─── Bill-text: daily 02:00 ───────────────────────────────────────────────

    @Cron('0 2 * * *', { name: 'bill-text-cron' })
    async runBillText() {
        if (!this.enabled) return;
        await this.runSingle('bill-text');
    }

    // ─── Full pipeline: weekly Sunday 03:00 ──────────────────────────────────

    @Cron('0 3 * * 0', { name: 'full-pipeline-cron' })
    async runFullPipeline() {
        if (!this.enabled) return;
        if (this.running) {
            this.logger.warn('Full pipeline cron skipped — previous run still in progress');
            return;
        }
        this.running = true;
        this.logger.log('⏰ Weekly full pipeline starting...');
        try {
            const result = await this.pipeline.runFull();
            this.logger.log(
                `Weekly full pipeline complete in ${result.durationMs}ms: ` +
                `legislators(${result.legislators.recordsNew}n/${result.legislators.recordsUpdated}u), ` +
                `bills(${result.bills.recordsNew}n/${result.bills.recordsUpdated}u)`,
            );
        } catch (err: any) {
            this.logger.error(`Weekly full pipeline failed: ${err.message}`);
        } finally {
            this.running = false;
        }
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private async runSingle(scraperName: string) {
        this.logger.log(`⏰ Cron: running ${scraperName}...`);
        try {
            const result = await this.pipeline.runSingle(scraperName);
            this.logger.log(
                `Cron ${scraperName} complete: ${result.recordsNew}n/${result.recordsUpdated}u in ${result.durationMs}ms`,
            );
        } catch (err: any) {
            this.logger.error(`Cron ${scraperName} failed: ${err.message}`);
        }
    }
}
