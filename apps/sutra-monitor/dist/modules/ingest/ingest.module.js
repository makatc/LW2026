"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestModule = void 0;
const common_1 = require("@nestjs/common");
const ingest_service_1 = require("./ingest.service");
const db_1 = require("@lwbeta/db");
const notification_module_1 = require("../notifications/notification.module");
const scraper_module_1 = require("../../scraper/scraper.module");
let IngestModule = exports.IngestModule = class IngestModule {
};
exports.IngestModule = IngestModule = __decorate([
    (0, common_1.Module)({
        imports: [notification_module_1.NotificationModule, scraper_module_1.ScraperModule],
        providers: [ingest_service_1.IngestService, db_1.ConfigRepository],
        exports: [ingest_service_1.IngestService],
    })
], IngestModule);
//# sourceMappingURL=ingest.module.js.map