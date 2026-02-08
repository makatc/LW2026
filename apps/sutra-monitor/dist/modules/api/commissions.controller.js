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
exports.CommissionController = exports.CommissionService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@lwbeta/db");
const common_2 = require("@nestjs/common");
let CommissionService = exports.CommissionService = class CommissionService {
    constructor(commissionRepo) {
        this.commissionRepo = commissionRepo;
    }
    async listAll() {
        return this.commissionRepo.listall();
    }
};
exports.CommissionService = CommissionService = __decorate([
    (0, common_2.Injectable)(),
    __metadata("design:paramtypes", [db_1.CommissionRepository])
], CommissionService);
let CommissionController = exports.CommissionController = class CommissionController {
    constructor(commissionService) {
        this.commissionService = commissionService;
    }
    async listAll() {
        return this.commissionService.listAll();
    }
};
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CommissionController.prototype, "listAll", null);
exports.CommissionController = CommissionController = __decorate([
    (0, common_1.Controller)('commissions'),
    __metadata("design:paramtypes", [CommissionService])
], CommissionController);
//# sourceMappingURL=commissions.controller.js.map