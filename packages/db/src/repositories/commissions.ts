import { pool } from '../client';
import { SutraCommission } from '@lwbeta/types';

export class CommissionRepository {
    async listall(): Promise<SutraCommission[]> {
        const result = await pool.query('SELECT * FROM sutra_commissions ORDER BY name ASC');
        return result.rows;
    }

    async findById(id: string): Promise<SutraCommission | null> {
        const result = await pool.query('SELECT * FROM sutra_commissions WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async findByName(name: string): Promise<SutraCommission | null> {
        const result = await pool.query('SELECT * FROM sutra_commissions WHERE name = $1', [name]);
        return result.rows[0] || null;
    }

    async upsert(name: string, category?: string): Promise<SutraCommission> {
        const slug = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        try {
            const result = await pool.query(
                `INSERT INTO sutra_commissions (name, slug, category) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, category = COALESCE(EXCLUDED.category, sutra_commissions.category)
                 RETURNING *`,
                [name, slug, category || null]
            );
            return result.rows[0];
        } catch (e: any) {
            // Handle unique constraint violation on slug if different name
            if (e.code === '23505' && e.constraint === 'sutra_commissions_slug_key') {
                // Try to fetch by slug and return? Or append suffix?
                // For now, let's return the existing one by slug
                const result = await pool.query('SELECT * FROM sutra_commissions WHERE slug = $1', [slug]);
                return result.rows[0];
            }
            throw e;
        }
    }
}
