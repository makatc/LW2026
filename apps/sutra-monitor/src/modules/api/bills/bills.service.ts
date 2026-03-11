import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class BillsApiService {
    constructor(private readonly db: DatabaseService) {}

    async findAll(params: {
        bill_type?: string;
        status?: string;
        commission?: string;
        author?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }) {
        const { bill_type, status, commission, author, search, limit = 50, offset = 0 } = params;
        const conditions: string[] = [];
        const values: any[] = [];

        if (bill_type) {
            values.push(bill_type);
            conditions.push(`sm.bill_type = $${values.length}`);
        }
        if (status) {
            values.push(`%${status}%`);
            conditions.push(`sm.status ILIKE $${values.length}`);
        }
        if (commission) {
            values.push(`%${commission}%`);
            conditions.push(`sc.name ILIKE $${values.length}`);
        }
        if (author) {
            values.push(`%${author}%`);
            conditions.push(`sm.author ILIKE $${values.length}`);
        }
        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(sm.titulo ILIKE $${values.length} OR sm.extracto ILIKE $${values.length} OR sm.numero ILIKE $${values.length})`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        values.push(limit);
        values.push(offset);

        const res = await this.db.query(
            `SELECT sm.id, sm.numero, sm.titulo, sm.extracto, sm.fecha, sm.source_url,
                    sm.bill_type, sm.status, sm.author, sm.author_names,
                    sm.last_seen_at, sm.updated_at,
                    sc.name AS commission_name, sc.id AS commission_id,
                    bv.id AS current_version_id, bv.pdf_url
             FROM sutra_measures sm
             LEFT JOIN sutra_commissions sc ON sc.id = sm.comision_id
             LEFT JOIN bill_versions bv ON bv.measure_id = sm.id AND bv.is_current = true
             ${where}
             ORDER BY sm.last_seen_at DESC NULLS LAST, sm.numero ASC
             LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        );

        const countRes = await this.db.query(
            `SELECT COUNT(*) FROM sutra_measures sm
             LEFT JOIN sutra_commissions sc ON sc.id = sm.comision_id
             ${where}`,
            values.slice(0, -2)
        );

        return {
            data: res.rows,
            total: parseInt(countRes.rows[0].count, 10),
            limit,
            offset,
        };
    }

    async findOne(id: string) {
        // Accept both UUID and numero
        const isUuid = /^[0-9a-f-]{36}$/i.test(id);
        const whereClause = isUuid ? 'sm.id = $1' : 'sm.numero = $1';

        const res = await this.db.query(
            `SELECT sm.*,
                    sc.name AS commission_name,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', bv.id,
                                'version_note', bv.version_note,
                                'pdf_url', bv.pdf_url,
                                'is_current', bv.is_current,
                                'created_at', bv.created_at
                            )
                        ) FILTER (WHERE bv.id IS NOT NULL), '[]'
                    ) AS versions,
                    COALESCE(
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'id', v.id,
                                'vote_date', v.vote_date,
                                'motion_text', v.motion_text,
                                'result', v.result,
                                'yea_count', v.yea_count,
                                'nay_count', v.nay_count,
                                'abstain_count', v.abstain_count,
                                'chamber', v.chamber
                            )
                        ) FILTER (WHERE v.id IS NOT NULL), '[]'
                    ) AS votes
             FROM sutra_measures sm
             LEFT JOIN sutra_commissions sc ON sc.id = sm.comision_id
             LEFT JOIN bill_versions bv ON bv.measure_id = sm.id
             LEFT JOIN votes v ON v.measure_id = sm.id
             WHERE ${whereClause}
             GROUP BY sm.id, sc.name`,
            [id]
        );

        return res.rows[0] || null;
    }

    async getSummary() {
        const res = await this.db.query(
            `SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE bill_type = 'bill') AS bills_count,
                COUNT(*) FILTER (WHERE bill_type = 'resolution') AS resolutions_count,
                COUNT(*) FILTER (WHERE bill_type = 'other') AS other_count,
                COUNT(*) FILTER (WHERE status ILIKE '%aprobado%') AS approved_count,
                COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days') AS recent_count
             FROM sutra_measures`
        );
        return res.rows[0];
    }
}
