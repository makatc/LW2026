import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SutraClient } from '../../scraper/sutra-client';
import { MeasureRepository, pool } from '@lwbeta/db';
import { logger } from '@lwbeta/utils';

@Injectable()
export class TrackingService {
    constructor(
        private readonly sutraClient: SutraClient,
        private readonly measureRepo: MeasureRepository
    ) { }

    @Cron(CronExpression.EVERY_4_HOURS)
    async runTrackingJob() {
        logger.info('Starting active tracking job');

        // 1. Get Watchlist
        // Assuming we want all enabled watchlist items across all configs
        const watchlistResult = await pool.query(`
      SELECT wi.*, sm.source_url, sm.numero 
      FROM watchlist_items wi
      JOIN sutra_measures sm ON wi.measure_id = sm.id
      WHERE wi.enabled = true
    `);
        const watchlist = watchlistResult.rows;

        logger.info({ count: watchlist.length }, 'Tracking measures found');

        for (const item of watchlist) {
            if (!item.source_url) continue;

            try {
                // 2. Fetch latest data
                const detail = await this.sutraClient.fetchMeasureDetail(item.source_url);
                const events = await this.sutraClient.fetchMeasureTimelineEvents(item.source_url);

                // 3. Detect Changes (Mock logic for V1)
                // In real impl: Compare detail.contentHash with stored snapshot hash

                // 4. Record Events
                for (const event of events) {
                    // Idempotent insert of events
                    await pool.query(`
            INSERT INTO measure_events (measure_id, event_type, title, event_date, hash, created_at, first_seen_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (measure_id, hash) DO NOTHING
          `, [item.measure_id, event.eventType, event.title, event.date, event.hash]);
                }

                // 5. Notify/Record Update (if logic detects diff)
                // Simplified: if we found new events, log it as an update
                if (events.length > 0) {
                    // Check if we just inserted them? 
                    // Ideally we check rowCount of the INSERT above.
                    // For now, logging heart beat
                }

            } catch (error) {
                logger.error({ measure: item.numero, err: error }, 'Failed to track measure');
            }
        }
    }
}
