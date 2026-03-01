import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private pool!: Pool;

    onModuleInit() {
        const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/sutra_monitor';
        console.log('🚀 Connecting to DB...');

        this.pool = new Pool({
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

    query(text: string, params?: any[]) {
        return this.pool.query(text, params);
    }
}
