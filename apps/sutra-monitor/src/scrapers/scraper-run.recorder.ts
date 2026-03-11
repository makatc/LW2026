import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../modules/database/database.service';

@Injectable()
export class ScraperRunRecorder {
    private readonly logger = new Logger(ScraperRunRecorder.name);

    constructor(private readonly db: DatabaseService) {}

    async start(scraperName: string): Promise<string> {
        const res = await this.db.query(
            `INSERT INTO scraper_runs (scraper_name, status) VALUES ($1, 'RUNNING') RETURNING id`,
            [scraperName]
        );
        return res.rows[0].id;
    }

    async complete(
        id: string,
        scraped: number,
        newCount: number,
        updated: number,
    ): Promise<void> {
        await this.db.query(
            `UPDATE scraper_runs SET
                status = 'SUCCESS',
                records_scraped = $1,
                records_new = $2,
                records_updated = $3,
                ended_at = NOW()
             WHERE id = $4`,
            [scraped, newCount, updated, id]
        );
    }

    async fail(id: string, error: string): Promise<void> {
        await this.db.query(
            `UPDATE scraper_runs SET status = 'FAILED', error_message = $1, ended_at = NOW() WHERE id = $2`,
            [error, id]
        );
    }

    async getLastRun(scraperName: string): Promise<any> {
        const res = await this.db.query(
            `SELECT * FROM scraper_runs WHERE scraper_name = $1 ORDER BY started_at DESC LIMIT 1`,
            [scraperName]
        );
        return res.rows[0] || null;
    }

    async getRecentRuns(limit = 20): Promise<any[]> {
        const res = await this.db.query(
            `SELECT * FROM scraper_runs ORDER BY started_at DESC LIMIT $1`,
            [limit]
        );
        return res.rows;
    }
}
