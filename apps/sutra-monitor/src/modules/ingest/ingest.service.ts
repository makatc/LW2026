import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SutraScraper } from '../../scraper/sutra.scraper';
import { DatabaseService } from '../database/database.service';
import { ConfigRepository } from '@lwbeta/db';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class IngestService {
    private readonly logger = new Logger(IngestService.name);

    constructor(
        private readonly scraper: SutraScraper,
        private readonly db: DatabaseService,
        private readonly configRepo: ConfigRepository,
        private readonly notificationService: NotificationService
    ) { }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async handleCron() {
        this.logger.log('Starting scheduled ingestion job...');
        await this.runIngestion();
    }

    async runIngestion() {
        let runId: string | null = null;

        try {
            this.logger.log('Creating run record...');
            runId = await this.createRunRecord();

            // Fetch update webhooks
            const updateWebhooks = await this.configRepo.getUpdateWebhooks();
            this.logger.log(`Found ${updateWebhooks.length} update webhooks to notify.`);

            this.logger.log('Scraping measures...');
            const measures = await this.scraper.scrapeLatest();
            this.logger.log(`Found ${measures.length} measures from scraper.`);

            let newCount = 0;
            let updatedCount = 0;

            for (const m of measures) {
                try {
                    let commissionId = null;

                    // 1. Upsert Commission
                    if (m.commission) {
                        const slug = m.commission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        const commRes = await this.db.query(
                            `INSERT INTO sutra_commissions (name, slug) VALUES ($1, $2)
                             ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
                             RETURNING id`,
                            [m.commission, slug]
                        );
                        commissionId = commRes.rows[0].id;
                    }

                    // 2. Check existence for notification diff
                    const existingRes = await this.db.query(
                        'SELECT id, hash, titulo FROM sutra_measures WHERE numero = $1',
                        [m.numero]
                    );
                    const existing = existingRes.rows[0];

                    // 3. Upsert Measure
                    const newHash = require('crypto').createHash('sha256').update(JSON.stringify(m)).digest('hex');

                    const measureRes = await this.db.query(
                        `INSERT INTO sutra_measures 
                         (numero, titulo, extracto, comision_id, fecha, source_url, hash, last_seen_at, author)
                         VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW(), $7)
                         ON CONFLICT (numero) DO UPDATE SET
                         titulo = EXCLUDED.titulo,
                         extracto = EXCLUDED.extracto,
                         comision_id = EXCLUDED.comision_id,
                         author = EXCLUDED.author,
                         last_seen_at = NOW(),
                         hash = EXCLUDED.hash
                         RETURNING id`,
                        [m.numero, m.titulo, m.extracto || '', commissionId, m.url, newHash, m.author || null]
                    );

                    // 4. Notify Logic
                    if (!existing) {
                        newCount++;
                        // New Measure Notification
                        for (const url of updateWebhooks) {
                            await this.notificationService.sendUpdate(url, `Nueva Medida: ${m.numero}`, m.titulo, {
                                'Comisión': m.commission || 'N/A',
                                'Link': m.url
                            });
                        }
                    } else if (existing.hash !== newHash) {
                        updatedCount++;
                        // Updated Measure Notification
                        for (const url of updateWebhooks) {
                            await this.notificationService.sendUpdate(url, `Medida Actualizada: ${m.numero}`, `${m.titulo} (Cambios detectados)`, {
                                'Comisión': m.commission || 'N/A',
                                'Link': m.url
                            });
                        }
                    }

                    // 5. Resolve Watchlist Items (Pending by Number)
                    if (!existing) { // Only needed for new items really, but harmless to run
                        await this.db.query(
                            `UPDATE watchlist_items SET measure_id = $1 WHERE measure_number = $2 AND measure_id IS NULL`,
                            [measureRes.rows[0].id, m.numero]
                        );
                    }
                } catch (measureError) {
                    this.logger.error(`Failed to process measure ${m.numero}:`, measureError);
                    // Continue with next measure instead of failing entire job
                }
            }

            await this.completeRunRecord(runId, 'SUCCESS', newCount, updatedCount);
            this.logger.log(`Ingestion completed: ${newCount} new, ${updatedCount} updated.`);

        } catch (error: any) {
            this.logger.error('Ingestion process failed', error);

            // Check if error is due to scraper being blocked
            const isBlocked = error.message?.includes('CAPTCHA') ||
                error.message?.includes('blocked') ||
                error.message?.includes('403') ||
                error.message?.includes('rate limit');

            const status = isBlocked ? 'NEEDS_MANUAL' : 'FAILED';
            const errorMsg = isBlocked
                ? `Scraper blocked: ${error.message}. Manual intervention required.`
                : error.message;

            if (runId) {
                await this.completeRunRecord(runId, status, 0, 0, errorMsg);
            }

            if (isBlocked) {
                this.logger.warn('⚠️ SCRAPER BLOCKED - Manual intervention required');
            }

            throw error;
        }
    }

    private async createRunRecord(): Promise<string> {
        const res = await this.db.query(
            "INSERT INTO ingest_runs (status) VALUES ('RUNNING') RETURNING id"
        );
        return res.rows[0].id;
    }

    private async completeRunRecord(id: string, status: string, newCount: number, updatedCount: number, errorMsg: string | null = null) {
        await this.db.query(
            `UPDATE ingest_runs 
             SET status = $1, measures_new = $2, measures_updated = $3, error_message = $4, ended_at = NOW() 
             WHERE id = $5`,
            [status, newCount, updatedCount, errorMsg, id]
        );
    }
}
