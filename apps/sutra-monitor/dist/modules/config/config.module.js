"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorConfigModule = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("./config.service");
const config_controller_1 = require("./config.controller");
const db_1 = require("@lwbeta/db");
const scraper_module_1 = require("../../scraper/scraper.module");
let MonitorConfigModule = exports.MonitorConfigModule = class MonitorConfigModule {
};
exports.MonitorConfigModule = MonitorConfigModule = __decorate([
    (0, common_1.Module)({
        imports: [scraper_module_1.ScraperModule],
        controllers: [config_controller_1.ConfigController],
        providers: [config_service_1.ConfigService, db_1.ConfigRepository],
        exports: [config_service_1.ConfigService]
    })
], MonitorConfigModule);
//# sourceMappingURL=config.module.js.map