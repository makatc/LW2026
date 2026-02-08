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
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const queues_1 = require("../../queues");
const workers_1 = require("../../queues/workers");
const ingest_module_1 = require("../ingest/ingest.module");
const discovery_module_1 = require("../discovery/discovery.module");
const tracking_module_1 = require("../tracking/tracking.module");
const ingest_service_1 = require("../ingest/ingest.service");
const discovery_service_1 = require("../discovery/discovery.service");
const tracking_service_1 = require("../tracking/tracking.service");
let QueueModule = exports.QueueModule = class QueueModule {
    constructor(ingestService, discoveryService, trackingService) {
        this.ingestService = ingestService;
        this.discoveryService = discoveryService;
        this.trackingService = trackingService;
        this.workers = [];
    }
    async onModuleInit() {
        // Create workers
        this.workers.push((0, workers_1.createIngestWorker)(this.ingestService));
        this.workers.push((0, workers_1.createDiscoveryWorker)(this.discoveryService));
        this.workers.push((0, workers_1.createTrackingWorker)(this.trackingService));
        // Schedule recurring jobs
        await queues_1.ingestQueue.add('scheduled-ingest', {}, {
            ...queues_1.defaultJobOptions,
            repeat: {
                pattern: '0 */6 * * *', // Every 6 hours
            },
        });
        await queues_1.discoveryQueue.add('scheduled-discovery', {}, {
            ...queues_1.defaultJobOptions,
            repeat: {
                pattern: '0 */12 * * *', // Every 12 hours
            },
        });
        await queues_1.trackingQueue.add('scheduled-tracking', {}, {
            ...queues_1.defaultJobOptions,
            repeat: {
                pattern: '0 */4 * * *', // Every 4 hours
            },
        });
        console.log('✅ BullMQ workers started and jobs scheduled');
    }
    async onModuleDestroy() {
        // Gracefully close all workers
        await Promise.all(this.workers.map(w => w.close()));
        console.log('✅ BullMQ workers closed');
    }
};
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [ingest_module_1.IngestModule, discovery_module_1.DiscoveryModule, tracking_module_1.ActiveTrackingModule],
    }),
    __metadata("design:paramtypes", [ingest_service_1.IngestService,
        discovery_service_1.DiscoveryService,
        tracking_service_1.TrackingService])
], QueueModule);
//# sourceMappingURL=queue.module.js.map