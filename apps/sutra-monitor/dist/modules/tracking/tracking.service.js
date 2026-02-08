"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sutra_client_1 = require("../../scraper/sutra-client");
const db_1 = require("@lwbeta/db");
const utils_1 = require("@lwbeta/utils");
let TrackingService = exports.TrackingService = class TrackingService {
    constructor(sutraClient, measureRepo) {
        this.sutraClient = sutraClient;
        this.measureRepo = measureRepo;
    }
    async runTrackingJob() {
        utils_1.logger.info('Starting active tracking job');
        // 1. Get Watchlist
        // Assuming we want all enabled watchlist items across all configs
        const watchlistResult = await db_1.pool.query(`
      SELECT wi.*, sm.source_url, sm.numero 
      FROM watchlist_items wi
      JOIN sutra_measures sm ON wi.measure_id = sm.id
      WHERE wi.enabled = true
    `);
        const watchlist = watchlistResult.rows;
        utils_1.logger.info({ count: watchlist.length }, 'Tracking measures found');
        for (const item of watchlist) {
            if (!item.source_url)
                continue;
            try {
                // 2. Fetch latest data
                const detail = await this.sutraClient.fetchMeasureDetail(item.source_url);
                const events = await this.sutraClient.fetchMeasureTimelineEvents(item.source_url);
                // 3. Detect Changes (Mock logic for V1)
                // In real impl: Compare detail.contentHash with stored snapshot hash
                // 4. Record Events
                for (const event of events) {
                    // Idempotent insert of events
                    await db_1.pool.query(`
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
            }
            catch (error) {
                utils_1.logger.error({ measure: item.numero, err: error }, 'Failed to track measure');
            }
        }
    }
};
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_4_HOURS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TrackingService.prototype, "runTrackingJob", null);
exports.TrackingService = TrackingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sutra_client_1.SutraClient,
        db_1.MeasureRepository])
], TrackingService);
//# sourceMappingURL=tracking.service.js.map