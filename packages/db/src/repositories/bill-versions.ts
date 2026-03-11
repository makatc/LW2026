import { pool } from '../client';
import { BillVersion } from '@lwbeta/types';

export class BillVersionRepository {
    async findByMeasure(measureId: string): Promise<BillVersion[]> {
        const result = await pool.query(
            `SELECT * FROM bill_versions
             WHERE measure_id = $1
             ORDER BY created_at DESC`,
            [measureId],
        );
        return result.rows;
    }

    async findCurrent(measureId: string): Promise<BillVersion | null> {
        const result = await pool.query(
            `SELECT * FROM bill_versions
             WHERE measure_id = $1 AND is_current = true
             LIMIT 1`,
            [measureId],
        );
        return result.rows[0] ?? null;
    }

    async findById(id: string): Promise<BillVersion | null> {
        const result = await pool.query('SELECT * FROM bill_versions WHERE id = $1', [id]);
        return result.rows[0] ?? null;
    }

    /**
     * Returns measures that have PDF URLs but no current bill_version — the
     * pending extraction queue used by BillTextScraper.
     */
    async findMeasuresNeedingExtraction(limit = 20): Promise<Array<{ id: string; numero: string; source_url: string }>> {
        const result = await pool.query(
            `SELECT sm.id, sm.numero, sm.source_url
             FROM sutra_measures sm
             LEFT JOIN bill_versions bv ON bv.measure_id = sm.id AND bv.is_current = true
             WHERE (sm.source_url ILIKE '%.pdf' OR sm.source_url ILIKE '%pdf%')
               AND bv.id IS NULL
             ORDER BY sm.updated_at DESC
             LIMIT $1`,
            [limit],
        );
        return result.rows;
    }

    async upsertVersion(data: {
        measure_id: string;
        version_note?: string;
        text_content: string;
        pdf_url?: string;
        hash: string;
    }): Promise<BillVersion> {
        // Mark all previous versions as non-current
        await pool.query(
            'UPDATE bill_versions SET is_current = false WHERE measure_id = $1',
            [data.measure_id],
        );
        // Insert new current version
        const result = await pool.query(
            `INSERT INTO bill_versions (measure_id, version_note, text_content, pdf_url, hash, is_current)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING *`,
            [data.measure_id, data.version_note ?? null, data.text_content, data.pdf_url ?? null, data.hash],
        );
        return result.rows[0];
    }

    async countByMeasure(measureId: string): Promise<number> {
        const result = await pool.query(
            'SELECT COUNT(*)::int FROM bill_versions WHERE measure_id = $1',
            [measureId],
        );
        return result.rows[0].count;
    }
}
