import { pool } from '../client';
import { ChangeEvent, ChangeEntityType, ChangeEventType } from '@lwbeta/types';

export class ChangeEventRepository {
    async record(data: {
        entity_type: ChangeEntityType;
        entity_id?: string | null;
        event_type: ChangeEventType;
        scraper_name?: string;
        summary: string;
        payload: Record<string, any>;
    }): Promise<ChangeEvent> {
        const result = await pool.query(
            `INSERT INTO change_events
                (entity_type, entity_id, event_type, scraper_name, summary, payload)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)
             RETURNING *`,
            [
                data.entity_type,
                data.entity_id ?? null,
                data.event_type,
                data.scraper_name ?? null,
                data.summary,
                JSON.stringify(data.payload),
            ],
        );
        return result.rows[0];
    }

    async findRecent(options: {
        entity_type?: ChangeEntityType;
        event_type?: ChangeEventType;
        entity_id?: string;
        since?: Date;
        limit?: number;
    } = {}): Promise<ChangeEvent[]> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (options.entity_type) {
            params.push(options.entity_type);
            conditions.push(`entity_type = $${params.length}`);
        }
        if (options.event_type) {
            params.push(options.event_type);
            conditions.push(`event_type = $${params.length}`);
        }
        if (options.entity_id) {
            params.push(options.entity_id);
            conditions.push(`entity_id = $${params.length}`);
        }
        if (options.since) {
            params.push(options.since.toISOString());
            conditions.push(`created_at > $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit ?? 50;
        params.push(limit);

        const result = await pool.query(
            `SELECT * FROM change_events
             ${where}
             ORDER BY created_at DESC
             LIMIT $${params.length}`,
            params,
        );
        return result.rows;
    }

    async getStats(days = 7): Promise<Record<string, number>> {
        const result = await pool.query(
            `SELECT entity_type, event_type, COUNT(*)::int AS count
             FROM change_events
             WHERE created_at > NOW() - INTERVAL '${days} days'
             GROUP BY entity_type, event_type
             ORDER BY entity_type, event_type`,
        );
        const stats: Record<string, number> = {};
        for (const row of result.rows) {
            stats[`${row.entity_type}.${row.event_type}`] = row.count;
        }
        return stats;
    }

    async findByEntity(entityType: ChangeEntityType, entityId: string): Promise<ChangeEvent[]> {
        const result = await pool.query(
            `SELECT * FROM change_events
             WHERE entity_type = $1 AND entity_id = $2
             ORDER BY created_at DESC`,
            [entityType, entityId],
        );
        return result.rows;
    }
}
