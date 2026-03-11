import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { pool } from '@lwbeta/db';
import { ConfigService } from '../config/config.service';
import { IngestService } from '../ingest/ingest.service';
import { NotificationService } from '../notifications/notification.service';

@Controller()
export class ApiController {
    private readonly logger = new Logger(ApiController.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly ingestService: IngestService,
        private readonly notificationService: NotificationService
    ) { }

    @Get('measures')
    async listMeasures() {
        const result = await pool.query('SELECT * FROM sutra_measures ORDER BY fecha DESC, created_at DESC LIMIT 100');
        return { measures: result.rows };
    }

    @Get('commissions')
    async listCommissions() {
        const result = await pool.query('SELECT * FROM sutra_commissions ORDER BY name ASC');
        return { commissions: result.rows };
    }

    // Temporary test endpoint to manually trigger notifications
    @Public()
    @Post('test/trigger-notifications')
    async triggerNotifications() {
        this.logger.log('🔔 Manual notification trigger requested');
        await this.notificationService.processPendingNotifications();
        return { success: true, message: 'Notification processing triggered' };
    }

    @Post('watchlist/:measureId/add')
    async addToWatchlist(@Param('measureId') measureId: string) {
        const config = await this.configService.getMyConfig();

        // Check if valid UUID
        // In real app use validation pipe

        const result = await pool.query(`
      INSERT INTO watchlist_items (config_id, measure_id, added_from, enabled)
      VALUES ($1, $2, 'DASHBOARD', true)
      ON CONFLICT (config_id, measure_id) DO NOTHING
      RETURNING *
    `, [config.id, measureId]);

        return result.rows[0] || { message: 'Already watched' };
    }

    @Post('config/watchlist/by-number')
    async addToWatchlistByNumber(@Body() body: { number: string }) {
        const config = await this.configService.getMyConfig();
        const { number } = body;

        // Try to find the measure in the database
        const measureResult = await pool.query(
            'SELECT * FROM sutra_measures WHERE numero = $1',
            [number]
        );

        if (measureResult.rows.length > 0) {
            // Measure exists, add it to watchlist
            const measure = measureResult.rows[0];
            const result = await pool.query(`
                INSERT INTO watchlist_items (config_id, measure_id, added_from, enabled)
                VALUES ($1, $2, 'MANUAL', true)
                ON CONFLICT (config_id, measure_id) DO NOTHING
                RETURNING *
            `, [config.id, measure.id]);

            return {
                success: true,
                measure,
                watchlistItem: result.rows[0] || { message: 'Already watched' }
            };
        } else {
            // Measure doesn't exist yet, add as pending
            const result = await pool.query(`
                INSERT INTO watchlist_items (config_id, measure_number, added_from, enabled)
                VALUES ($1, $2, 'MANUAL', true)
                RETURNING *
            `, [config.id, number]);

            return {
                success: true,
                pending: true,
                message: `Medida ${number} agregada como pendiente. Se resolverá en el próximo scrape.`,
                watchlistItem: result.rows[0]
            };
        }
    }


    @Get('measures/:id')
    async getMeasureDetail(@Param('id') id: string) {
        const measure = await pool.query('SELECT * FROM sutra_measures WHERE id = $1', [id]);
        const history = await pool.query('SELECT * FROM measure_events WHERE measure_id = $1 ORDER BY event_date DESC', [id]);

        return {
            measure: measure.rows[0],
            history: history.rows
        };
    }

    // Enhanced bills endpoints (new, alongside /measures for backward compat)
    @Get('api/bills')
    @Public()
    async listBills() {
        const result = await pool.query(
            `SELECT sm.id, sm.numero, sm.titulo, sm.bill_type, sm.status, sm.fecha,
                    sm.author, sm.author_names, sm.subjects, sm.source_url,
                    sc.name AS commission_name
             FROM sutra_measures sm
             LEFT JOIN sutra_commissions sc ON sc.id = sm.comision_id
             ORDER BY sm.fecha DESC NULLS LAST, sm.created_at DESC
             LIMIT 100`
        );
        return { bills: result.rows };
    }

    @Get('api/bills/:id')
    @Public()
    async getBillDetail(@Param('id') id: string) {
        const bill = await pool.query(
            `SELECT sm.*, sc.name AS commission_name
             FROM sutra_measures sm
             LEFT JOIN sutra_commissions sc ON sc.id = sm.comision_id
             WHERE sm.id = $1`,
            [id]
        );
        if (bill.rows.length === 0) return null;

        const versions = await pool.query(
            'SELECT id, version_note, pdf_url, is_current, scraped_at FROM bill_versions WHERE measure_id = $1 ORDER BY scraped_at DESC',
            [id]
        );
        const votes = await pool.query(
            'SELECT id, vote_date, motion_text, result, yea_count, nay_count, chamber FROM votes WHERE measure_id = $1 ORDER BY vote_date DESC',
            [id]
        );
        const history = await pool.query(
            'SELECT * FROM measure_events WHERE measure_id = $1 ORDER BY event_date DESC',
            [id]
        );

        return {
            ...bill.rows[0],
            versions: versions.rows,
            votes: votes.rows,
            history: history.rows,
        };
    }

    @Post('ingest/trigger')
    async triggerIngest() {
        this.ingestService.runIngestion(); // Run in background usually, but here we can wait or just trigger
        return { message: 'Ingestion triggered' };
    }

    @Get('config/email-preferences')
    async getEmailPreferences() {
        const config = await this.configService.getMyConfig();
        const preferences = await this.configService.getEmailPreferences(config.id);

        if (!preferences) {
            return {
                enabled: true,
                frequency: 'daily'
            };
        }

        return preferences;
    }

    @Post('config/email-preferences')
    async saveEmailPreferences(@Body() body: { enabled: boolean, frequency: 'daily' | 'weekly' }) {
        const config = await this.configService.getMyConfig();
        const { enabled, frequency } = body;

        await this.configService.updateEmailPreferences(config.id, enabled, frequency);

        return { success: true };
    }

}
