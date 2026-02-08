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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@lwbeta/db");
const decorators_1 = require("../auth/decorators");
const ingest_service_1 = require("../ingest/ingest.service");
const discovery_service_1 = require("../discovery/discovery.service");
let HealthController = exports.HealthController = class HealthController {
    constructor(discoveryService, ingestService) {
        this.discoveryService = discoveryService;
        this.ingestService = ingestService;
    }
    async healthCheck() {
        const checks = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                database: 'unknown',
                redis: 'unknown'
            }
        };
        // Check database
        try {
            await db_1.pool.query('SELECT 1');
            checks.services.database = 'healthy';
        }
        catch (e) {
            checks.services.database = 'unhealthy';
            checks.status = 'degraded';
        }
        // Check Redis
        try {
            const Redis = require('ioredis');
            const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
            await redis.ping();
            await redis.quit();
            checks.services.redis = 'healthy';
        }
        catch (e) {
            checks.services.redis = 'unhealthy';
            checks.status = 'degraded';
        }
        return checks;
    }
};
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "healthCheck", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [discovery_service_1.DiscoveryService,
        ingest_service_1.IngestService])
], HealthController);
//# sourceMappingURL=health.controller.js.map