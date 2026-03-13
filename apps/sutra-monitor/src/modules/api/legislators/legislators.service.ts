import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class LegislatorsApiService {
    constructor(private readonly db: DatabaseService) { }

    async findAll(params: {
        chamber?: string;
        party?: string;
        committee?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }) {
        const { chamber, party, committee, search, limit = 100, offset = 0 } = params;
        const conditions: string[] = ['l.is_active = true'];
        const values: any[] = [];

        if (chamber) {
            values.push(chamber);
            conditions.push(`l.chamber = $${values.length}`);
        }
        if (party) {
            values.push(party);
            conditions.push(`l.party = $${values.length}`);
        }
        if (search) {
            values.push(`%${search}%`);
            conditions.push(`l.full_name ILIKE $${values.length}`);
        }

        let joinClause = '';
        if (committee) {
            values.push(`%${committee}%`);
            joinClause = `LEFT JOIN legislator_committee_memberships_v2 lcm ON lcm.legislator_id = l.id`;
            conditions.push(`lcm.committee_name ILIKE $${values.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        values.push(limit);
        values.push(offset);

        const res = await this.db.query(
            `SELECT DISTINCT l.id, l.full_name, l.chamber, l.party, l.district, l.email, l.phone,
                    l.office, l.photo_url, l.source_url, l.scraped_at, l.updated_at
             FROM legislators l
             ${joinClause}
             ${where}
             ORDER BY l.chamber, l.full_name
             LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        );

        const countRes = await this.db.query(
            `SELECT COUNT(DISTINCT l.id) FROM legislators l ${joinClause} ${where}`,
            values.slice(0, -2)
        );

        return {
            data: res.rows,
            total: parseInt(countRes.rows[0].count, 10),
            limit,
            offset,
        };
    }

    async findOne(id: string, userId?: string) {
        let privateMetadataSelect = `NULL as private_metadata`;
        let privateMetadataJoin = ``;
        const params: any[] = [id];

        if (userId) {
            params.push(userId);
            privateMetadataSelect = `(
                SELECT row_to_json(ulm) FROM user_legislator_metadata ulm
                WHERE ulm.legislator_id = l.id AND ulm.user_id = $2
            ) AS private_metadata`;
        }

        const res = await this.db.query(
            `SELECT l.*,
                    COALESCE(
                        (SELECT json_agg(sub) FROM (
                            SELECT c.id AS committee_id, c.name AS committee_name, c.chamber, cm.role
                            FROM committee_memberships cm
                            JOIN committees c ON c.id = cm.committee_id
                            WHERE cm.legislator_id = l.id
                            UNION ALL
                            SELECT lcm.id, lcm.committee_name, NULL as chamber, lcm.role::text
                            FROM legislator_committee_memberships_v2 lcm
                            WHERE lcm.legislator_id = l.id
                        ) sub), '[]'
                    ) AS memberships,
                    COALESCE(
                        (SELECT json_agg(
                            json_build_object(
                                'id', ls.id,
                                'name', ls.name,
                                'title', ls.title,
                                'email', ls.email
                            )
                        ) FROM legislator_staff ls WHERE ls.legislator_id = l.id), '[]'
                    ) AS staff,
                    (SELECT row_to_json(lip)
                     FROM legislator_intelligence_profiles lip
                     WHERE lip.legislator_id = l.id
                    ) AS intelligence_profile,
                    ${privateMetadataSelect}
             FROM legislators l
             ${privateMetadataJoin}
             WHERE l.id = $1`,
            params
        );
        if (!res.rows[0]) throw new NotFoundException('Legislator not found');
        return res.rows[0];
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

    async create(data: {
        full_name: string;
        chamber: string;
        party?: string;
        district?: string;
        email?: string;
        phone?: string;
        office?: string;
        photo_url?: string;
    }) {
        const res = await this.db.query(
            `INSERT INTO legislators (full_name, chamber, party, district, email, phone, office, photo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [data.full_name, data.chamber, data.party, data.district, data.email, data.phone, data.office, data.photo_url]
        );
        return res.rows[0];
    }

    async update(id: string, data: Record<string, any>) {
        const allowed = ['full_name', 'chamber', 'party', 'district', 'email', 'phone', 'office', 'photo_url', 'is_active'];
        const updates: string[] = [];
        const values: any[] = [];

        for (const key of allowed) {
            if (data[key] !== undefined) {
                values.push(data[key]);
                updates.push(`${key} = $${values.length}`);
            }
        }

        if (updates.length === 0) throw new NotFoundException('No valid fields to update');

        values.push(id);
        updates.push(`updated_at = NOW()`);

        const res = await this.db.query(
            `UPDATE legislators SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (!res.rows[0]) throw new NotFoundException('Legislator not found');
        return res.rows[0];
    }

    async updatePrivateMetadata(legislatorId: string, userId: string, data: Record<string, any>) {
        const res = await this.db.query(
            `INSERT INTO user_legislator_metadata (user_id, legislator_id, private_phone, private_email, private_notes, private_contacts, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (user_id, legislator_id) DO UPDATE SET
                private_phone = EXCLUDED.private_phone,
                private_email = EXCLUDED.private_email,
                private_notes = EXCLUDED.private_notes,
                private_contacts = EXCLUDED.private_contacts,
                updated_at = NOW()
             RETURNING *`,
            [
                userId, 
                legislatorId, 
                data.private_phone || null, 
                data.private_email || null, 
                data.private_notes || null,
                JSON.stringify(data.private_contacts || [])
            ]
        );
        return res.rows[0];
    }

    // ─── Staff ────────────────────────────────────────────────────────────────

    async getStaff(legislatorId: string) {
        const res = await this.db.query(
            `SELECT id, name, title, email, created_at, updated_at
             FROM legislator_staff
             WHERE legislator_id = $1
             ORDER BY name`,
            [legislatorId]
        );
        return { data: res.rows };
    }

    async addStaff(legislatorId: string, data: { name: string; title: string; email?: string }) {
        const res = await this.db.query(
            `INSERT INTO legislator_staff (legislator_id, name, title, email)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [legislatorId, data.name, data.title, data.email || null]
        );
        return res.rows[0];
    }

    // ─── Committees ───────────────────────────────────────────────────────────

    async getCommittees(legislatorId: string) {
        // Combine both table sources
        const res = await this.db.query(
            `SELECT c.id, c.name AS committee_name, c.chamber, cm.role
             FROM committee_memberships cm
             JOIN committees c ON c.id = cm.committee_id
             WHERE cm.legislator_id = $1
             UNION ALL
             SELECT lcm.id, lcm.committee_name, NULL as chamber, lcm.role::text
             FROM legislator_committee_memberships_v2 lcm
             WHERE lcm.legislator_id = $1
             ORDER BY committee_name`,
            [legislatorId]
        );
        return { data: res.rows };
    }

    // ─── Interactions ─────────────────────────────────────────────────────────

    async getInteractions(legislatorId: string, params: { limit: number; offset: number }) {
        const res = await this.db.query(
            `SELECT i.*,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'id', im.id,
                            'measure_id', im.measure_id,
                            'measure_reference', im.measure_reference,
                            'position_expressed', im.position_expressed
                        )) FROM interaction_measures im WHERE im.interaction_id = i.id), '[]'
                    ) AS measures,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'id', ip.id,
                            'staff_id', ip.staff_id,
                            'custom_name', ip.custom_name,
                            'staff_name', ls.name,
                            'staff_title', ls.title
                        )) FROM interaction_participants ip
                          LEFT JOIN legislator_staff ls ON ls.id = ip.staff_id
                          WHERE ip.interaction_id = i.id), '[]'
                    ) AS participants,
                    (SELECT COUNT(*) FROM interaction_attachments ia WHERE ia.interaction_id = i.id)::int AS attachment_count
             FROM interactions i
             WHERE i.legislator_id = $1 AND i.is_deleted = false
             ORDER BY i.interaction_date DESC
             LIMIT $2 OFFSET $3`,
            [legislatorId, params.limit, params.offset]
        );

        const countRes = await this.db.query(
            `SELECT COUNT(*) FROM interactions WHERE legislator_id = $1 AND is_deleted = false`,
            [legislatorId]
        );

        return {
            data: res.rows,
            total: parseInt(countRes.rows[0].count, 10),
        };
    }

    // ─── Intelligence ─────────────────────────────────────────────────────────

    async getIntelligenceProfile(legislatorId: string) {
        const res = await this.db.query(
            `SELECT * FROM legislator_intelligence_profiles WHERE legislator_id = $1`,
            [legislatorId]
        );
        return res.rows[0] || null;
    }

    // ─── Positions ────────────────────────────────────────────────────────────

    async getPositions(legislatorId: string) {
        const res = await this.db.query(
            `SELECT lmp.*,
                    sm.numero AS measure_number,
                    sm.titulo AS measure_title,
                    sm.status AS measure_status
             FROM legislator_measure_positions lmp
             LEFT JOIN sutra_measures sm ON sm.id = lmp.measure_id
             WHERE lmp.legislator_id = $1 AND lmp.is_superseded = false
             ORDER BY lmp.updated_at DESC`,
            [legislatorId]
        );
        return { data: res.rows };
    }
}
