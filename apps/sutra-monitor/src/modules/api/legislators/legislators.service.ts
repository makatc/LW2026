import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class LegislatorsApiService {
    constructor(private readonly db: DatabaseService) {}

    async findAll(params: { chamber?: string; party?: string; limit?: number; offset?: number }) {
        const { chamber, party, limit = 100, offset = 0 } = params;
        const conditions: string[] = ['is_active = true'];
        const values: any[] = [];

        if (chamber) {
            values.push(chamber);
            conditions.push(`chamber = $${values.length}`);
        }
        if (party) {
            values.push(party);
            conditions.push(`party = $${values.length}`);
        }

        values.push(limit);
        values.push(offset);

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const res = await this.db.query(
            `SELECT id, full_name, chamber, party, district, email, phone, office, photo_url, source_url, scraped_at, updated_at
             FROM legislators
             ${where}
             ORDER BY chamber, full_name
             LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        );

        const countRes = await this.db.query(
            `SELECT COUNT(*) FROM legislators ${where}`,
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
        const res = await this.db.query(
            `SELECT l.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'committee_id', c.id,
                                'committee_name', c.name,
                                'chamber', c.chamber,
                                'role', cm.role
                            )
                        ) FILTER (WHERE c.id IS NOT NULL), '[]'
                    ) AS memberships
             FROM legislators l
             LEFT JOIN committee_memberships cm ON cm.legislator_id = l.id
             LEFT JOIN committees c ON c.id = cm.committee_id
             WHERE l.id = $1
             GROUP BY l.id`,
            [id]
        );
        return res.rows[0] || null;
    }

    async getSummary() {
        const res = await this.db.query(
            `SELECT
                COUNT(*) FILTER (WHERE is_active = true) AS total_active,
                COUNT(*) FILTER (WHERE chamber = 'upper' AND is_active = true) AS senate_count,
                COUNT(*) FILTER (WHERE chamber = 'lower' AND is_active = true) AS house_count,
                json_object_agg(COALESCE(party, 'IND'), party_count) AS by_party
             FROM (
                 SELECT chamber, party, is_active, COUNT(*) AS party_count
                 FROM legislators
                 WHERE is_active = true
                 GROUP BY chamber, party, is_active
             ) sub`
        );
        return res.rows[0];
    }
}
