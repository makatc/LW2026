"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const core_1 = require("@nestjs/core");
const ingest_module_1 = require("./modules/ingest/ingest.module");
const config_module_1 = require("./modules/config/config.module");
const discovery_module_1 = require("./modules/discovery/discovery.module");
const tracking_module_1 = require("./modules/tracking/tracking.module");
const api_module_1 = require("./modules/api/api.module");
const database_module_1 = require("./modules/database/database.module");
const health_module_1 = require("./modules/health/health.module");
const queue_module_1 = require("./modules/queue/queue.module");
const auth_module_1 = require("./modules/auth/auth.module");
const jwt_auth_guard_1 = require("./modules/auth/jwt-auth.guard");
const database_migration_service_1 = require("./database-migration.service");
let AppModule = exports.AppModule = class AppModule {
};
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            schedule_1.ScheduleModule.forRoot(),
            auth_module_1.AuthModule,
            ingest_module_1.IngestModule,
            config_module_1.MonitorConfigModule,
            discovery_module_1.DiscoveryModule,
            tracking_module_1.ActiveTrackingModule,
            api_module_1.ApiModule,
            database_module_1.DatabaseModule,
            health_module_1.HealthModule,
            queue_module_1.QueueModule,
        ],
        controllers: [],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard,
            },
            database_migration_service_1.DatabaseMigrationService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map