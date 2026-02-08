"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryModule = void 0;
const common_1 = require("@nestjs/common");
const discovery_service_1 = require("./discovery.service");
const config_module_1 = require("../config/config.module");
const db_1 = require("@lwbeta/db");
const notification_module_1 = require("../notifications/notification.module");
let DiscoveryModule = exports.DiscoveryModule = class DiscoveryModule {
};
exports.DiscoveryModule = DiscoveryModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.MonitorConfigModule, notification_module_1.NotificationModule],
        providers: [discovery_service_1.DiscoveryService, db_1.MeasureRepository, db_1.SystemRepository],
        exports: [discovery_service_1.DiscoveryService],
    })
], DiscoveryModule);
//# sourceMappingURL=discovery.module.js.map