import { Controller, Get } from '@nestjs/common';
import { pool } from '@lwbeta/db';
import { Public } from '../auth/decorators';

@Controller('health')
export class HealthController {

    @Public()
    @Get()
    async healthCheck() {
        const checks = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                database: 'unknown',
                redis: 'unknown'
            }
        };

        // Check database
        try {
            await pool.query('SELECT 1');
            checks.services.database = 'healthy';
        } catch (e) {
            checks.services.database = 'unhealthy';
            checks.status = 'degraded';
        }

        // Check Redis
        try {
            const Redis = require('ioredis');
            const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
            await redis.ping();
            await redis.quit();
            checks.services.redis = 'healthy';
        } catch (e) {
            checks.services.redis = 'unhealthy';
            checks.status = 'degraded';
        }

        return checks;
    }
}
