import { pool } from '../client';
import { Legislator } from '@lwbeta/types';

export class LegislatorRepository {
    async findAll(options: {
        chamber?: 'upper' | 'lower';
        party?: string;
        is_active?: boolean;
        limit?: number;
        offset?: number;
    } = {}): Promise<Legislator[]> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (options.chamber) {
            params.push(options.chamber);
            conditions.push(`chamber = $${params.length}`);
        }
        if (options.party) {
            params.push(options.party);
            conditions.push(`party = $${params.length}`);
        }
        if (options.is_active !== undefined) {
            params.push(options.is_active);
            conditions.push(`is_active = $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit ?? 100;
        const offset = options.offset ?? 0;
        params.push(limit, offset);

        const result = await pool.query(
            `SELECT * FROM legislators ${where}
             ORDER BY chamber, full_name
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );
        return result.rows;
    }

    async findById(id: string): Promise<Legislator | null> {
        const result = await pool.query('SELECT * FROM legislators WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }

    async findByName(fullName: string, chamber?: string): Promise<Legislator | null> {
        if (chamber) {
            const result = await pool.query(
                'SELECT * FROM legislators WHERE full_name ILIKE $1 AND chamber = $2 LIMIT 1',
                [fullName, chamber],
            );
            return result.rows[0] ?? null;
        }
        const result = await pool.query(
            'SELECT * FROM legislators WHERE full_name ILIKE $1 LIMIT 1',
            [fullName],
        );
        return result.rows[0] ?? null;
    }

    async upsert(data: Omit<Legislator, 'id' | 'created_at' | 'updated_at'>): Promise<Legislator> {
        const result = await pool.query(
            `INSERT INTO legislators
                (full_name, chamber, party, district, email, phone, office, photo_url, is_active, source_url, hash, scraped_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
             ON CONFLICT (chamber, full_name) DO UPDATE SET
                party = EXCLUDED.party,
                district = EXCLUDED.district,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                office = EXCLUDED.office,
                photo_url = EXCLUDED.photo_url,
                is_active = EXCLUDED.is_active,
                source_url = EXCLUDED.source_url,
                hash = EXCLUDED.hash,
                scraped_at = NOW(),
                updated_at = NOW()
             RETURNING *`,
            [
                data.full_name, data.chamber, data.party ?? null, data.district ?? null,
                data.email ?? null, data.phone ?? null, data.office ?? null,
                data.photo_url ?? null, data.is_active, data.source_url ?? null, data.hash ?? null,
            ],
        );
        return result.rows[0];
    }

    async count(chamber?: 'upper' | 'lower'): Promise<number> {
        const result = chamber
            ? await pool.query('SELECT COUNT(*)::int FROM legislators WHERE chamber = $1 AND is_active = true', [chamber])
            : await pool.query('SELECT COUNT(*)::int FROM legislators WHERE is_active = true');
        return result.rows[0].count;
    }
}
