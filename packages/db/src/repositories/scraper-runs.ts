import { pool } from '../client';
import { ScraperRun } from '@lwbeta/types';

export class ScraperRunRepository {
    async start(scraperName: string): Promise<ScraperRun> {
        const result = await pool.query(
            `INSERT INTO scraper_runs (scraper_name, status)
             VALUES ($1, 'RUNNING')
             RETURNING *`,
            [scraperName],
        );
        return result.rows[0];
    }

    async complete(
        id: string,
        scraped: number,
        newCount: number,
        updated: number,
    ): Promise<ScraperRun> {
        const result = await pool.query(
            `UPDATE scraper_runs SET
                status = 'SUCCESS',
                records_scraped = $1,
                records_new = $2,
                records_updated = $3,
                ended_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [scraped, newCount, updated, id],
        );
        return result.rows[0];
    }

    async fail(id: string, errorMessage: string): Promise<ScraperRun> {
        const result = await pool.query(
            `UPDATE scraper_runs SET
                status = 'FAILED',
                error_message = $1,
                ended_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [errorMessage, id],
        );
        return result.rows[0];
    }

    async findLast(scraperName: string): Promise<ScraperRun | null> {
        const result = await pool.query(
            `SELECT * FROM scraper_runs
             WHERE scraper_name = $1
             ORDER BY started_at DESC
             LIMIT 1`,
            [scraperName],
        );
        return result.rows[0] ?? null;
    }

    async findRecent(limit = 20): Promise<ScraperRun[]> {
        const result = await pool.query(
            `SELECT * FROM scraper_runs
             ORDER BY started_at DESC
             LIMIT $1`,
            [limit],
        );
        return result.rows;
    }

    async getStats(): Promise<Record<string, { last_run: Date; success_count: number; fail_count: number }>> {
        const result = await pool.query(
            `SELECT
                scraper_name,
                MAX(started_at) AS last_run,
                COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS success_count,
                COUNT(*) FILTER (WHERE status = 'FAILED')::int AS fail_count
             FROM scraper_runs
             WHERE started_at > NOW() - INTERVAL '30 days'
             GROUP BY scraper_name
             ORDER BY scraper_name`,
        );
        const stats: Record<string, any> = {};
        for (const row of result.rows) {
            stats[row.scraper_name] = {
                last_run: row.last_run,
                success_count: row.success_count,
                fail_count: row.fail_count,
            };
        }
        return stats;
    }
}
