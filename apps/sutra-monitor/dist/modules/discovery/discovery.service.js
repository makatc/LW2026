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
exports.DiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_service_1 = require("../config/config.service");
const db_1 = require("@lwbeta/db");
const utils_1 = require("@lwbeta/utils");
const notification_service_1 = require("../notifications/notification.service");
let DiscoveryService = exports.DiscoveryService = class DiscoveryService {
    constructor(configService, measureRepo, systemRepo, notificationService) {
        this.configService = configService;
        this.measureRepo = measureRepo;
        this.systemRepo = systemRepo;
        this.notificationService = notificationService;
    }
    async runDiscoveryJob() {
        utils_1.logger.info('Starting discovery job');
        // 1. Get ALL Active Rules (Fan-Out)
        const allRules = await this.configService.getAllActiveRules();
        if (allRules.length === 0) {
            utils_1.logger.info('No keywords configured in the entire system, skipping discovery');
            return;
        }
        // 2. Fetch Cursor (High Watermark)
        const cursorDate = await this.systemRepo.getDiscoveryCursor();
        utils_1.logger.info(`Scanning for measures updated after: ${cursorDate.toISOString()}`);
        // 3. Fetch ONLY new/updated measures since cursor
        const result = await db_1.pool.query('SELECT * FROM sutra_measures WHERE updated_at > $1 ORDER BY updated_at ASC', [cursorDate]);
        const measures = result.rows;
        if (measures.length === 0) {
            utils_1.logger.info('No new measures found since last run.');
            return;
        }
        utils_1.logger.info(`Found ${measures.length} new/updated measures to scan.`);
        let hits = 0;
        let maxUpdatedAt = cursorDate;
        // 4. Match Loop (Fan-Out)
        for (const measure of measures) {
            // Track max timestamp for cursor update
            const measureDate = new Date(measure.updated_at);
            if (measureDate > maxUpdatedAt) {
                maxUpdatedAt = measureDate;
            }
            for (const rule of allRules) {
                if (this.matchKeyword(measure, rule.keyword)) {
                    await this.processHit(measure, rule, 'KEYWORD');
                    hits++;
                }
            }
        }
        // 5. Update Cursor
        if (measures.length > 0) {
            await this.systemRepo.setDiscoveryCursor(maxUpdatedAt);
            utils_1.logger.info(`Updated discovery cursor to: ${maxUpdatedAt.toISOString()}`);
        }
        utils_1.logger.info({ hits }, 'Discovery job completed');
    }
    matchKeyword(measure, keyword) {
        const content = (0, utils_1.normalizeText)(`${measure.titulo} ${measure.extracto || ''}`);
        const target = (0, utils_1.normalizeText)(keyword);
        return content.includes(target);
    }
    async processHit(measure, rule, type) {
        const configId = rule.config_id;
        const result = await db_1.pool.query(`INSERT INTO discovery_hits (config_id, measure_id, hit_type, rule_id, score, evidence, created_at)
             VALUES ($1, $2, $3, $4, 100, $5, NOW())
             ON CONFLICT (config_id, measure_id, hit_type, rule_id) DO NOTHING`, [configId, measure.id, type, rule.id, `Matched keyword: ${rule.keyword}`]);
        // If insert was successful (rowCount > 0), send notification
        if (result.rowCount && result.rowCount > 0) {
            if (rule.webhook_alerts) {
                await this.notificationService.sendAlert(rule.webhook_alerts, measure, `Palabra clave: ${rule.keyword}`);
            }
        }
    }
};
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DiscoveryService.prototype, "runDiscoveryJob", null);
exports.DiscoveryService = DiscoveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        db_1.MeasureRepository,
        db_1.SystemRepository,
        notification_service_1.NotificationService])
], DiscoveryService);
//# sourceMappingURL=discovery.service.js.map