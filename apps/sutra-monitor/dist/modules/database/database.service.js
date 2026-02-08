"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
let DatabaseService = exports.DatabaseService = class DatabaseService {
    onModuleInit() {
        const connectionString = 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor';
        console.log('🚀 FORZANDO CONEXIÓN A:', connectionString);
        this.pool = new pg_1.Pool({
            connectionString,
        });
        // Test connection
        this.pool.query('SELECT 1').then(() => {
            console.log('✅ Database connected');
        }).catch(err => {
            console.error('❌ Database connection failed', err);
        });
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
    query(text, params) {
        return this.pool.query(text, params);
    }
};
exports.DatabaseService = DatabaseService = __decorate([
    (0, common_1.Injectable)()
], DatabaseService);
//# sourceMappingURL=database.service.js.map