import { pool } from '../client';
import { Committee, CommitteeMembership } from '@lwbeta/types';

export class CommitteeRepository {
    async findAll(options: {
        chamber?: 'upper' | 'lower' | 'joint';
        type?: string;
        is_active?: boolean;
    } = {}): Promise<Committee[]> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (options.chamber) {
            params.push(options.chamber);
            conditions.push(`c.chamber = $${params.length}`);
        }
        if (options.type) {
            params.push(options.type);
            conditions.push(`c.type = $${params.length}`);
        }
        if (options.is_active !== undefined) {
            params.push(options.is_active);
            conditions.push(`c.is_active = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await pool.query(
            `SELECT c.*, l.full_name AS chair_name
             FROM committees c
             LEFT JOIN legislators l ON l.id = c.chair_id
             ${where}
             ORDER BY c.chamber, c.name`,
            params,
        );
        return result.rows;
    }

    async findById(id: string): Promise<Committee | null> {
        const result = await pool.query('SELECT * FROM committees WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }

    async findByName(name: string, chamber?: string): Promise<Committee | null> {
        if (chamber) {
            const result = await pool.query(
                'SELECT * FROM committees WHERE name = $1 AND chamber = $2 LIMIT 1',
                [name, chamber],
            );
            return result.rows[0] ?? null;
        }
        const result = await pool.query(
            'SELECT * FROM committees WHERE name = $1 LIMIT 1',
            [name],
        );
        return result.rows[0] ?? null;
    }

    async getMemberships(committeeId: string): Promise<(CommitteeMembership & { full_name: string })[]> {
        const result = await pool.query(
            `SELECT cm.*, l.full_name, l.party, l.chamber
             FROM committee_memberships cm
             JOIN legislators l ON l.id = cm.legislator_id
             WHERE cm.committee_id = $1
             ORDER BY cm.role, l.full_name`,
            [committeeId],
        );
        return result.rows;
    }

    async getLegislatorCommittees(legislatorId: string): Promise<Committee[]> {
        const result = await pool.query(
            `SELECT c.*, cm.role
             FROM committees c
             JOIN committee_memberships cm ON cm.committee_id = c.id
             WHERE cm.legislator_id = $1
             ORDER BY c.name`,
            [legislatorId],
        );
        return result.rows;
    }
}
