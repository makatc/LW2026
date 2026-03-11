import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CommitteesApiService {
    constructor(private readonly db: DatabaseService) {}

    async findAll(params: { chamber?: string; type?: string }) {
        const { chamber, type } = params;
        const conditions: string[] = ['c.is_active = true'];
        const values: any[] = [];

        if (chamber) {
            values.push(chamber);
            conditions.push(`c.chamber = $${values.length}`);
        }
        if (type) {
            values.push(type);
            conditions.push(`c.type = $${values.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const res = await this.db.query(
            `SELECT c.id, c.name, c.slug, c.chamber, c.type, c.source_url,
                    l.full_name AS chair_name, l.party AS chair_party,
                    COUNT(cm.id) AS member_count
             FROM committees c
             LEFT JOIN legislators l ON l.id = c.chair_id
             LEFT JOIN committee_memberships cm ON cm.committee_id = c.id
             ${where}
             GROUP BY c.id, l.full_name, l.party
             ORDER BY c.chamber, c.name`,
            values
        );

        return res.rows;
    }

    async findOne(id: string) {
        const committeRes = await this.db.query(
            `SELECT c.*, l.full_name AS chair_name, l.party AS chair_party, l.email AS chair_email
             FROM committees c
             LEFT JOIN legislators l ON l.id = c.chair_id
             WHERE c.id = $1`,
            [id]
        );

        if (committeRes.rows.length === 0) return null;

        const membersRes = await this.db.query(
            `SELECT leg.id, leg.full_name, leg.party, leg.district, leg.photo_url, cm.role
             FROM committee_memberships cm
             JOIN legislators leg ON leg.id = cm.legislator_id
             WHERE cm.committee_id = $1
             ORDER BY cm.role, leg.full_name`,
            [id]
        );

        // Recent bills referred to this committee
        const billsRes = await this.db.query(
            `SELECT sm.id, sm.numero, sm.titulo, sm.fecha, sm.status, sm.bill_type
             FROM sutra_measures sm
             JOIN sutra_commissions sc ON sc.id = sm.comision_id
             JOIN committees c ON c.sutra_commission_id = sc.id
             WHERE c.id = $1
             ORDER BY sm.updated_at DESC
             LIMIT 10`,
            [id]
        );

        return {
            ...committeRes.rows[0],
            members: membersRes.rows,
            recent_bills: billsRes.rows,
        };
    }
}
