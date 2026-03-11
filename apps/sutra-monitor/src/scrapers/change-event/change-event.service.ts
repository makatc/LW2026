import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DatabaseService } from '../../modules/database/database.service';
import {
    ChangeEventPayload,
    ChangeEntityType,
    ChangeEventRow,
} from './change-event.types';

/**
 * ChangeEventService
 *
 * Records scraper-detected changes (bill.created, legislator.updated, etc.)
 * to the `change_events` table and re-emits them as in-process Node events.
 *
 * Usage:
 *   await this.changeEvents.record({ entityType: 'bill', eventType: 'created', ... });
 *
 * Listening in-process:
 *   changeEventService.on('bill.created', (row) => { ... });
 *   changeEventService.on('*', (row) => { ... });
 */
@Injectable()
export class ChangeEventService extends EventEmitter implements OnModuleInit {
    private readonly logger = new Logger(ChangeEventService.name);

    constructor(private readonly db: DatabaseService) {
        super();
        this.setMaxListeners(50);
    }

    async onModuleInit(): Promise<void> {
        await this.ensureTable();
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    async record(payload: ChangeEventPayload): Promise<void> {
        try {
            const res = await this.db.query(
                `INSERT INTO change_events
                    (entity_type, entity_id, event_type, scraper_name, summary, payload)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                 RETURNING id, created_at`,
                [
                    payload.entityType,
                    payload.entityId ?? null,
                    payload.eventType,
                    payload.scraperName,
                    payload.summary,
                    JSON.stringify(payload.after),
                ],
            );

            const row: ChangeEventRow = {
                id: res.rows[0].id,
                entity_type: payload.entityType,
                entity_id: payload.entityId ?? null,
                event_type: payload.eventType,
                scraper_name: payload.scraperName,
                summary: payload.summary,
                payload: payload.after,
                created_at: res.rows[0].created_at,
            };

            // Emit specific event (e.g. "bill.created") and wildcard "*"
            const eventName = `${payload.entityType}.${payload.eventType}`;
            this.emit(eventName, row);
            this.emit('*', row);

            this.logger.debug(`[${eventName}] ${payload.summary}`);
        } catch (err: any) {
            // Change events are non-critical — log but never break the pipeline
            this.logger.warn(`Failed to record change event: ${err.message}`);
        }
    }

    async getRecent(options: {
        entityType?: ChangeEntityType;
        limit?: number;
        since?: Date;
    } = {}): Promise<ChangeEventRow[]> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (options.entityType) {
            params.push(options.entityType);
            conditions.push(`entity_type = $${params.length}`);
        }
        if (options.since) {
            params.push(options.since.toISOString());
            conditions.push(`created_at > $${params.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit ?? 50;
        params.push(limit);

        const res = await this.db.query(
            `SELECT id, entity_type, entity_id, event_type, scraper_name, summary, payload, created_at
             FROM change_events
             ${where}
             ORDER BY created_at DESC
             LIMIT $${params.length}`,
            params,
        );

        return res.rows;
    }

    async getStats(): Promise<Record<string, number>> {
        const res = await this.db.query(
            `SELECT entity_type, event_type, COUNT(*)::int as count
             FROM change_events
             WHERE created_at > NOW() - INTERVAL '7 days'
             GROUP BY entity_type, event_type
             ORDER BY entity_type, event_type`,
        );

        const stats: Record<string, number> = {};
        for (const row of res.rows) {
            stats[`${row.entity_type}.${row.event_type}`] = row.count;
        }
        return stats;
    }

    // ─── Schema bootstrap ─────────────────────────────────────────────────────

    private async ensureTable(): Promise<void> {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS change_events (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    entity_type  VARCHAR(50)  NOT NULL,
                    entity_id    UUID,
                    event_type   VARCHAR(20)  NOT NULL,
                    scraper_name VARCHAR(50),
                    summary      TEXT         NOT NULL DEFAULT '',
                    payload      JSONB        NOT NULL DEFAULT '{}',
                    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                )
            `);
            await this.db.query(`
                CREATE INDEX IF NOT EXISTS idx_change_events_entity
                ON change_events (entity_type, entity_id)
            `);
            await this.db.query(`
                CREATE INDEX IF NOT EXISTS idx_change_events_created
                ON change_events (created_at DESC)
            `);
        } catch (err: any) {
            this.logger.error(`Table bootstrap failed: ${err.message}`);
        }
    }
}
