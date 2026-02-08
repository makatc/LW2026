"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveTrackingModule = void 0;
const common_1 = require("@nestjs/common");
const tracking_service_1 = require("./tracking.service");
const sutra_client_1 = require("../../scraper/sutra-client");
const db_1 = require("@lwbeta/db");
let ActiveTrackingModule = exports.ActiveTrackingModule = class ActiveTrackingModule {
};
exports.ActiveTrackingModule = ActiveTrackingModule = __decorate([
    (0, common_1.Module)({
        providers: [tracking_service_1.TrackingService, sutra_client_1.SutraClient, db_1.MeasureRepository],
        exports: [tracking_service_1.TrackingService],
    })
], ActiveTrackingModule);
//# sourceMappingURL=tracking.module.js.map