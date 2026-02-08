"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiModule = void 0;
const common_1 = require("@nestjs/common");
const dashboard_controller_1 = require("./dashboard.controller");
const api_controller_1 = require("./api.controller");
const commissions_controller_1 = require("./commissions.controller");
const config_module_1 = require("../config/config.module");
const db_1 = require("@lwbeta/db");
const notification_module_1 = require("../notifications/notification.module");
const ingest_module_1 = require("../ingest/ingest.module");
let ApiModule = exports.ApiModule = class ApiModule {
};
exports.ApiModule = ApiModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.MonitorConfigModule, ingest_module_1.IngestModule, notification_module_1.NotificationModule],
        controllers: [dashboard_controller_1.DashboardController, api_controller_1.ApiController, commissions_controller_1.CommissionController],
        providers: [commissions_controller_1.CommissionService, db_1.SystemRepository],
    })
], ApiModule);
//# sourceMappingURL=api.module.js.map