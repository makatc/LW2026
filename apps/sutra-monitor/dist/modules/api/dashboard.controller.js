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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@lwbeta/db");
const config_service_1 = require("../config/config.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const decorators_1 = require("../auth/decorators");
let DashboardController = exports.DashboardController = class DashboardController {
    constructor(configService) {
        this.configService = configService;
    }
    async getSummary(userId) {
        // 1. Keyword Hits Count
        const keywords = await db_1.pool.query(`
            SELECT COUNT(*) 
            FROM discovery_hits dh
            JOIN monitor_configs mc ON dh.config_id = mc.id
            WHERE dh.hit_type = 'KEYWORD' AND mc.user_id = $1
        `, [userId]);
        // 2. Topic Hits Count
        const topics = await db_1.pool.query(`
            SELECT COUNT(*) 
            FROM discovery_hits dh
            JOIN monitor_configs mc ON dh.config_id = mc.id
            WHERE dh.hit_type = 'TOPIC' AND mc.user_id = $1
        `, [userId]);
        // 3. Commission Hits Count
        const commissions = await db_1.pool.query(`
            SELECT COUNT(*) 
            FROM discovery_hits dh
            JOIN monitor_configs mc ON dh.config_id = mc.id
            WHERE dh.hit_type = 'COMMISSION' AND mc.user_id = $1
        `, [userId]);
        // 4. Watchlist Updates Count
        const updates = await db_1.pool.query(`
            SELECT COUNT(*) 
            FROM watchlist_items wi
            JOIN monitor_configs mc ON wi.config_id = mc.id
            WHERE mc.user_id = $1 AND wi.enabled = true
        `, [userId]);
        return {
            hits_keyword: parseInt(keywords.rows[0].count),
            hits_topics: parseInt(topics.rows[0].count),
            hits_commissions: parseInt(commissions.rows[0].count),
            watchlist_count: parseInt(updates.rows[0].count)
        };
    }
    async getFindings(userId, limit) {
        const limitNum = limit ? parseInt(limit) : 10;
        const result = await db_1.pool.query(`
      SELECT 
        dh.id,
        dh.hit_type as type,
        dh.measure_id as "measureId",
        dh.matched_text as "matchedText",
        dh.keyword,
        dh.created_at as "createdAt",
        m.numero,
        m.titulo,
        m.estado,
        m.fecha_ingreso as "fechaIngreso"
      FROM discovery_hits dh
      JOIN monitor_configs mc ON dh.config_id = mc.id
      JOIN measures m ON dh.measure_id = m.id
      WHERE mc.user_id = $1 
        AND dh.hit_type IN ('KEYWORD', 'TOPIC')
      ORDER BY dh.created_at DESC
      LIMIT $2
    `, [userId, limitNum]);
        return {
            data: result.rows.map(row => ({
                id: row.id,
                type: row.type.toLowerCase(),
                measureId: row.measureId,
                matchedText: row.matchedText || row.keyword,
                keyword: row.keyword,
                createdAt: row.createdAt,
                measure: {
                    numero: row.numero,
                    titulo: row.titulo,
                    estado: row.estado,
                    fechaIngreso: row.fechaIngreso
                }
            }))
        };
    }
    async getWatchlistItems(userId, limit) {
        const limitNum = limit ? parseInt(limit) : 10;
        const result = await db_1.pool.query(`
      SELECT 
        wi.id,
        wi.measure_id as "measureId",
        wi.updated_at as "updatedAt",
        m.numero,
        m.titulo,
        m.estado,
        m.fecha_ingreso as "fechaIngreso"
      FROM watchlist_items wi
      JOIN monitor_configs mc ON wi.config_id = mc.id
      JOIN measures m ON wi.measure_id = m.id
      WHERE mc.user_id = $1 AND wi.enabled = true
      ORDER BY wi.updated_at DESC
      LIMIT $2
    `, [userId, limitNum]);
        return {
            data: result.rows.map(row => ({
                id: row.id,
                measureId: row.measureId,
                updatedAt: row.updatedAt,
                measure: {
                    numero: row.numero,
                    titulo: row.titulo,
                    estado: row.estado,
                    fechaIngreso: row.fechaIngreso
                }
            }))
        };
    }
    async getCommissionNotifications(userId, limit) {
        const limitNum = limit ? parseInt(limit) : 10;
        const result = await db_1.pool.query(`
      SELECT 
        dh.id,
        dh.measure_id as "measureId",
        dh.matched_text as "commissionName",
        dh.created_at as "createdAt",
        m.numero,
        m.titulo,
        m.estado,
        m.fecha_ingreso as "fechaIngreso"
      FROM discovery_hits dh
      JOIN monitor_configs mc ON dh.config_id = mc.id
      JOIN measures m ON dh.measure_id = m.id
      WHERE mc.user_id = $1 AND dh.hit_type = 'COMMISSION'
      ORDER BY dh.created_at DESC
      LIMIT $2
    `, [userId, limitNum]);
        return {
            data: result.rows.map(row => ({
                id: row.id,
                measureId: row.measureId,
                commissionName: row.commissionName,
                eventType: 'Actualización',
                createdAt: row.createdAt,
                measure: {
                    numero: row.numero,
                    titulo: row.titulo,
                    estado: row.estado,
                    fechaIngreso: row.fechaIngreso
                }
            }))
        };
    }
};
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, decorators_1.UserID)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('findings'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getFindings", null);
__decorate([
    (0, common_1.Get)('watchlist'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getWatchlistItems", null);
__decorate([
    (0, common_1.Get)('commissions'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getCommissionNotifications", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map