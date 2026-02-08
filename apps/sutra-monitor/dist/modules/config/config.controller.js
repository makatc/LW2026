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
exports.ConfigController = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("./config.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const decorators_1 = require("../auth/decorators");
let ConfigController = exports.ConfigController = class ConfigController {
    constructor(configService) {
        this.configService = configService;
    }
    async getWebhooks(userId) {
        const config = await this.configService.getMyConfig(userId);
        return {
            alertsUrl: config.webhook_alerts || '',
            updatesUrl: config.webhook_sutra_updates || ''
        };
    }
    async updateWebhooks(userId, body) {
        return this.configService.updateWebhooks(userId, body);
    }
    async listKeywords(userId) {
        return this.configService.getKeywords(userId);
    }
    async addKeyword(userId, keyword) {
        return this.configService.addKeyword(userId, keyword);
    }
    async deleteKeyword(userId, id) {
        return this.configService.deleteKeyword(userId, id);
    }
    // Phrases / Topics
    async listPhrases(userId) {
        return this.configService.getPhrases(userId);
    }
    async addPhrase(userId, phrase) {
        return this.configService.addPhrase(userId, phrase);
    }
    async deletePhrase(userId, id) {
        return this.configService.deletePhrase(userId, id);
    }
    // Commissions
    async listAllCommissions() {
        // Returns all available commissions from the database
        return this.configService.getAllCommissions();
    }
    async listFollowedCommissions(userId) {
        // Returns commissions that the user is following
        return this.configService.getFollowedCommissions(userId);
    }
    async fetchRemoteCommissions() {
        // Scrapes fresh commission data from SUTRA website
        return this.configService.fetchRemoteCommissions();
    }
    async seedOfficialCommissions() {
        // Seeds the database with the official 2025-2028 commission list
        return this.configService.seedOfficialCommissions();
    }
    async followCommission(userId, commissionId) {
        return this.configService.followCommission(userId, commissionId);
    }
    async unfollowCommission(userId, commissionId) {
        return this.configService.unfollowCommission(userId, commissionId);
    }
    // Watchlist
    async listWatchlist(userId) {
        return this.configService.getWatchlist(userId);
    }
    async addToWatchlist(userId, measureId) {
        return this.configService.addToWatchlist(userId, measureId);
    }
    async addToWatchlistByNumber(userId, number) {
        return this.configService.addToWatchlistByNumber(userId, number);
    }
    async removeFromWatchlist(userId, measureId) {
        return this.configService.removeFromWatchlist(userId, measureId);
    }
};
__decorate([
    (0, common_1.Get)('webhooks'),
    __param(0, (0, decorators_1.UserID)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "getWebhooks", null);
__decorate([
    (0, common_1.Post)('webhooks'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "updateWebhooks", null);
__decorate([
    (0, common_1.Get)('keywords'),
    __param(0, (0, decorators_1.UserID)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "listKeywords", null);
__decorate([
    (0, common_1.Post)('keywords'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Body)('keyword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "addKeyword", null);
__decorate([
    (0, common_1.Delete)('keywords/:id'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "deleteKeyword", null);
__decorate([
    (0, common_1.Get)('phrases'),
    __param(0, (0, decorators_1.UserID)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "listPhrases", null);
__decorate([
    (0, common_1.Post)('phrases'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Body)('phrase')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "addPhrase", null);
__decorate([
    (0, common_1.Delete)('phrases/:id'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "deletePhrase", null);
__decorate([
    (0, common_1.Get)('commissions/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "listAllCommissions", null);
__decorate([
    (0, common_1.Get)('commissions/followed'),
    __param(0, (0, decorators_1.UserID)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "listFollowedCommissions", null);
__decorate([
    (0, common_1.Get)('commissions/remote'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "fetchRemoteCommissions", null);
__decorate([
    (0, common_1.Post)('commissions/seed-official'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "seedOfficialCommissions", null);
__decorate([
    (0, common_1.Post)('commissions/follow'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Body)('commissionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "followCommission", null);
__decorate([
    (0, common_1.Delete)('commissions/follow/:commissionId'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Param)('commissionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "unfollowCommission", null);
__decorate([
    (0, common_1.Get)('watchlist'),
    __param(0, (0, decorators_1.UserID)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "listWatchlist", null);
__decorate([
    (0, common_1.Post)('watchlist'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Body)('measureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "addToWatchlist", null);
__decorate([
    (0, common_1.Post)('watchlist/by-number'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Body)('number')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "addToWatchlistByNumber", null);
__decorate([
    (0, common_1.Delete)('watchlist/:measureId'),
    __param(0, (0, decorators_1.UserID)()),
    __param(1, (0, common_1.Param)('measureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "removeFromWatchlist", null);
exports.ConfigController = ConfigController = __decorate([
    (0, common_1.Controller)('config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], ConfigController);
//# sourceMappingURL=config.controller.js.map