import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import { MeasureRepository, SystemRepository, pool } from '@lwbeta/db';
import { logger, normalizeText } from '@lwbeta/utils';
import { SutraMeasure, KeywordRule } from '@lwbeta/types';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class DiscoveryService {
    constructor(
        private readonly configService: ConfigService,
        private readonly measureRepo: MeasureRepository,
        private readonly systemRepo: SystemRepository,
        private readonly notificationService: NotificationService
    ) { }

    @Cron(CronExpression.EVERY_HOUR)
    async runDiscoveryJob() {
        logger.info('Starting discovery job');

        // 1. Get ALL Active Rules (Fan-Out)
        const allRules = await this.configService.getAllActiveRules();
        if (allRules.length === 0) {
            logger.info('No keywords configured in the entire system, skipping discovery');
            return;
        }

        // 2. Fetch Cursor (High Watermark)
        const cursorDate = await this.systemRepo.getDiscoveryCursor();
        logger.info(`Scanning for measures updated after: ${cursorDate.toISOString()}`);

        // 3. Fetch ONLY new/updated measures since cursor
        const result = await pool.query(
            'SELECT * FROM sutra_measures WHERE updated_at > $1 ORDER BY updated_at ASC',
            [cursorDate]
        );
        const measures: SutraMeasure[] = result.rows;

        if (measures.length === 0) {
            logger.info('No new measures found since last run.');
            return;
        }

        logger.info(`Found ${measures.length} new/updated measures to scan.`);

        let hits = 0;
        let maxUpdatedAt = cursorDate;

        // 4. Match Loop (Fan-Out)
        for (const measure of measures) {
            // Track max timestamp for cursor update
            const measureDate = new Date(measure.updated_at);
            if (measureDate > maxUpdatedAt) {
                maxUpdatedAt = measureDate;
            }

            for (const rule of allRules) {
                if (this.matchKeyword(measure, rule.keyword)) {
                    await this.processHit(measure, rule, 'KEYWORD');
                    hits++;
                }
            }
        }

        // 5. Update Cursor
        if (measures.length > 0) {
            await this.systemRepo.setDiscoveryCursor(maxUpdatedAt);
            logger.info(`Updated discovery cursor to: ${maxUpdatedAt.toISOString()}`);
        }

        logger.info({ hits }, 'Discovery job completed');
    }

    private matchKeyword(measure: SutraMeasure, keyword: string): boolean {
        const content = normalizeText(`${measure.titulo} ${measure.extracto || ''}`);
        const target = normalizeText(keyword);
        return content.includes(target);
    }

    private async processHit(measure: SutraMeasure, rule: KeywordRule & { webhook_alerts?: string }, type: string) {
        const configId = rule.config_id;
        const result = await pool.query(
            `INSERT INTO discovery_hits (config_id, measure_id, hit_type, rule_id, score, evidence, created_at)
             VALUES ($1, $2, $3, $4, 100, $5, NOW())
             ON CONFLICT (config_id, measure_id, hit_type, rule_id) DO NOTHING`,
            [configId, measure.id, type, rule.id, `Matched keyword: ${rule.keyword}`]
        );

        // If insert was successful (rowCount > 0), send notification
        if (result.rowCount && result.rowCount > 0) {
            if (rule.webhook_alerts) {
                await this.notificationService.sendAlert(
                    rule.webhook_alerts,
                    measure,
                    `Palabra clave: ${rule.keyword}`
                );
            }
        }
    }
}
