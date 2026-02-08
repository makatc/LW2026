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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ApiController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../auth/public.decorator");
const db_1 = require("@lwbeta/db");
const config_service_1 = require("../config/config.service");
const ingest_service_1 = require("../ingest/ingest.service");
const notification_service_1 = require("../notifications/notification.service");
let ApiController = exports.ApiController = ApiController_1 = class ApiController {
    constructor(configService, ingestService, notificationService) {
        this.configService = configService;
        this.ingestService = ingestService;
        this.notificationService = notificationService;
        this.logger = new common_1.Logger(ApiController_1.name);
    }
    async listMeasures() {
        const result = await db_1.pool.query('SELECT * FROM sutra_measures ORDER BY fecha DESC, created_at DESC LIMIT 100');
        return { measures: result.rows };
    }
    async listCommissions() {
        const result = await db_1.pool.query('SELECT * FROM sutra_commissions ORDER BY name ASC');
        return { commissions: result.rows };
    }
    // Temporary test endpoint to manually trigger notifications
    async triggerNotifications() {
        this.logger.log('🔔 Manual notification trigger requested');
        await this.notificationService.processPendingNotifications();
        return { success: true, message: 'Notification processing triggered' };
    }
    async addToWatchlist(measureId) {
        const config = await this.configService.getMyConfig();
        // Check if valid UUID
        // In real app use validation pipe
        const result = await db_1.pool.query(`
      INSERT INTO watchlist_items (config_id, measure_id, added_from, enabled)
      VALUES ($1, $2, 'DASHBOARD', true)
      ON CONFLICT (config_id, measure_id) DO NOTHING
      RETURNING *
    `, [config.id, measureId]);
        return result.rows[0] || { message: 'Already watched' };
    }
    async addToWatchlistByNumber(body) {
        const config = await this.configService.getMyConfig();
        const { number } = body;
        // Try to find the measure in the database
        const measureResult = await db_1.pool.query('SELECT * FROM sutra_measures WHERE numero = $1', [number]);
        if (measureResult.rows.length > 0) {
            // Measure exists, add it to watchlist
            const measure = measureResult.rows[0];
            const result = await db_1.pool.query(`
                INSERT INTO watchlist_items (config_id, measure_id, added_from, enabled)
                VALUES ($1, $2, 'MANUAL', true)
                ON CONFLICT (config_id, measure_id) DO NOTHING
                RETURNING *
            `, [config.id, measure.id]);
            return {
                success: true,
                measure,
                watchlistItem: result.rows[0] || { message: 'Already watched' }
            };
        }
        else {
            // Measure doesn't exist yet, add as pending
            const result = await db_1.pool.query(`
                INSERT INTO watchlist_items (config_id, measure_number, added_from, enabled)
                VALUES ($1, $2, 'MANUAL', true)
                RETURNING *
            `, [config.id, number]);
            return {
                success: true,
                pending: true,
                message: `Medida ${number} agregada como pendiente. Se resolverá en el próximo scrape.`,
                watchlistItem: result.rows[0]
            };
        }
    }
    async getMeasureDetail(id) {
        const measure = await db_1.pool.query('SELECT * FROM sutra_measures WHERE id = $1', [id]);
        const history = await db_1.pool.query('SELECT * FROM measure_events WHERE measure_id = $1 ORDER BY event_date DESC', [id]);
        return {
            measure: measure.rows[0],
            history: history.rows
        };
    }
    async triggerIngest() {
        this.ingestService.runIngestion(); // Run in background usually, but here we can wait or just trigger
        return { message: 'Ingestion triggered' };
    }
    async getEmailPreferences() {
        const config = await this.configService.getMyConfig();
        const preferences = await this.configService.getEmailPreferences(config.id);
        if (!preferences) {
            return {
                enabled: true,
                frequency: 'daily'
            };
        }
        return preferences;
    }
    async saveEmailPreferences(body) {
        const config = await this.configService.getMyConfig();
        const { enabled, frequency } = body;
        await this.configService.updateEmailPreferences(config.id, enabled, frequency);
        return { success: true };
    }
    async fixSchema() {
        console.log('fixSchema called');
        let localClient;
        try {
            const { Client } = require('pg');
            const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sutra_monitor';
            console.log('Connecting to:', dbUrl);
            localClient = new Client({ connectionString: dbUrl });
            await localClient.connect();
            console.log('Connected. Running ALTER...');
            await localClient.query('ALTER TABLE sutra_commissions ALTER COLUMN name TYPE TEXT');
            await localClient.query('ALTER TABLE sutra_commissions ALTER COLUMN slug TYPE TEXT');
            console.log('Schema fixed successfully');
            await localClient.end();
            return { message: 'Schema fixed' };
        }
        catch (e) {
            console.error('Schema fix error:', e);
            if (localClient)
                await localClient.end().catch(() => { });
            return { status: 'error', message: e.message };
        }
    }
};
__decorate([
    (0, common_1.Get)('measures'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "listMeasures", null);
__decorate([
    (0, common_1.Get)('commissions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "listCommissions", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('test/trigger-notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "triggerNotifications", null);
__decorate([
    (0, common_1.Post)('watchlist/:measureId/add'),
    __param(0, (0, common_1.Param)('measureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "addToWatchlist", null);
__decorate([
    (0, common_1.Post)('config/watchlist/by-number'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "addToWatchlistByNumber", null);
__decorate([
    (0, common_1.Get)('measures/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "getMeasureDetail", null);
__decorate([
    (0, common_1.Post)('ingest/trigger'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "triggerIngest", null);
__decorate([
    (0, common_1.Get)('config/email-preferences'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "getEmailPreferences", null);
__decorate([
    (0, common_1.Post)('config/email-preferences'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "saveEmailPreferences", null);
__decorate([
    (0, common_1.Post)('fix-schema'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "fixSchema", null);
exports.ApiController = ApiController = ApiController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        ingest_service_1.IngestService,
        notification_service_1.NotificationService])
], ApiController);
//# sourceMappingURL=api.controller.js.map