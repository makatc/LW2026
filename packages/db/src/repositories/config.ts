import { pool } from '../client';
import { MonitorConfig, KeywordRule } from '@lwbeta/types';

export class ConfigRepository {
    async getOrCreateDefaultConfig(userId?: string): Promise<MonitorConfig> {
        // For now, assuming single user or one main config per user
        let query = 'SELECT * FROM monitor_configs LIMIT 1';
        let params: any[] = [];

        if (userId) {
            query = 'SELECT * FROM monitor_configs WHERE user_id = $1 LIMIT 1';
            params = [userId];
        }

        const result = await pool.query(query, params);
        if (result.rows[0]) return result.rows[0];

        return (await pool.query('INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING *', [userId || null])).rows[0];
    }

    async updateWebhooks(configId: string, alertsUrl: string, updatesUrl: string): Promise<MonitorConfig> {
        const result = await pool.query(
            `UPDATE monitor_configs 
             SET webhook_alerts = $2, webhook_sutra_updates = $3
             WHERE id = $1
             RETURNING *`,
            [configId, alertsUrl, updatesUrl]
        );
        return result.rows[0];
    }

    async addKeywordRule(configId: string, keyword: string): Promise<KeywordRule> {
        const result = await pool.query(
            `INSERT INTO keyword_rules (config_id, keyword) VALUES ($1, $2) RETURNING *`,
            [configId, keyword]
        );
        return result.rows[0];
    }

    async getKeywords(configId: string): Promise<KeywordRule[]> {
        const result = await pool.query(
            'SELECT * FROM keyword_rules WHERE config_id = $1 AND enabled = true ORDER BY created_at DESC',
            [configId]
        );
        return result.rows;
    }

    async deleteKeywordRule(id: string): Promise<void> {
        await pool.query('DELETE FROM keyword_rules WHERE id = $1', [id]);
    }

    // Admin / System Methods
    async getAllActiveRules(): Promise<(KeywordRule & { webhook_alerts?: string })[]> {
        const result = await pool.query(
            `SELECT kr.*, mc.webhook_alerts
             FROM keyword_rules kr
             JOIN monitor_configs mc ON kr.config_id = mc.id
             WHERE kr.enabled = true`
        );
        return result.rows;
    }

    async getUpdateWebhooks(): Promise<string[]> {
        const result = await pool.query(
            `SELECT DISTINCT webhook_sutra_updates 
             FROM monitor_configs 
             WHERE webhook_sutra_updates IS NOT NULL AND webhook_sutra_updates != ''`
        );
        return result.rows.map(r => r.webhook_sutra_updates);
    }

    // Phrases / Topics
    async addPhraseRule(configId: string, phrase: string): Promise<any> {
        const result = await pool.query(
            `INSERT INTO phrase_rules (config_id, phrase) VALUES ($1, $2) RETURNING *`,
            [configId, phrase]
        );
        return result.rows[0];
    }

    async getPhraseRules(configId: string): Promise<any[]> {
        const result = await pool.query(
            'SELECT * FROM phrase_rules WHERE config_id = $1 AND enabled = true ORDER BY created_at DESC',
            [configId]
        );
        return result.rows;
    }

    async deletePhraseRule(id: string): Promise<void> {
        await pool.query('DELETE FROM phrase_rules WHERE id = $1', [id]);
    }

    // Commission Follows
    async followCommission(configId: string, commissionId: string): Promise<any> {
        const result = await pool.query(
            `INSERT INTO commission_follows (config_id, commission_id) VALUES ($1, $2) 
             ON CONFLICT (config_id, commission_id) DO UPDATE SET enabled = true
             RETURNING *`,
            [configId, commissionId]
        );
        return result.rows[0];
    }

    async unfollowCommission(configId: string, commissionId: string): Promise<void> {
        await pool.query(
            'DELETE FROM commission_follows WHERE config_id = $1 AND commission_id = $2',
            [configId, commissionId]
        );
    }

    async getFollowedCommissions(configId: string): Promise<any[]> {
        const result = await pool.query(
            `SELECT cf.*, sc.name as commission_name 
             FROM commission_follows cf
             JOIN sutra_commissions sc ON cf.commission_id = sc.id
             WHERE cf.config_id = $1 AND cf.enabled = true`,
            [configId]
        );
        return result.rows;
    }

    // Watchlist
    async addToWatchlist(configId: string, measureId: string | null, addedFrom: string, measureNumber?: string): Promise<any> {
        let query = `INSERT INTO watchlist_items (config_id, measure_id, added_from) VALUES ($1, $2, $3)`;
        let params = [configId, measureId, addedFrom];
        let conflictTarget = '(config_id, measure_id)';

        if (measureNumber && !measureId) {
            query = `INSERT INTO watchlist_items (config_id, measure_number, added_from) VALUES ($1, $2, $3)`;
            params = [configId, measureNumber, addedFrom];
            // Note: Postgres unique constraint on multiple nullable columns behaves differently, 
            // but for now we assume unique index on measure_number helps or application logic prevents duplicates
            conflictTarget = '(config_id, measure_number)'; // Assuming we add this index or rely on app logic
        }

        const result = await pool.query(
            `${query} RETURNING *`,
            params
        );
        return result.rows[0];
    }

    async removeFromWatchlist(configId: string, measureId: string): Promise<void> {
        await pool.query(
            'DELETE FROM watchlist_items WHERE config_id = $1 AND measure_id = $2',
            [configId, measureId]
        );
    }

    async getWatchlist(configId: string): Promise<any[]> {
        // Updated to join with sutra_measures to get measure details
        const result = await pool.query(
            `SELECT wi.*, sm.numero, sm.titulo 
             FROM watchlist_items wi
             LEFT JOIN sutra_measures sm ON wi.measure_id = sm.id
             WHERE wi.config_id = $1 AND wi.enabled = true`,
            [configId]
        );
        return result.rows;
    }

    // Email Notification Preferences
    async getEmailPreferences(configId: string): Promise<{
        enabled: boolean;
        frequency: string;
    } | null> {
        const result = await pool.query(
            `SELECT email_notifications_enabled, email_frequency
             FROM monitor_configs
             WHERE id = $1`,
            [configId]
        );

        if (!result.rows[0]) return null;

        const row = result.rows[0];
        return {
            enabled: row.email_notifications_enabled ?? true,
            frequency: row.email_frequency || 'daily'
        };
    }

    async updateEmailPreferences(
        configId: string,
        enabled: boolean,
        frequency: 'daily' | 'weekly'
    ): Promise<void> {
        await pool.query(
            `UPDATE monitor_configs
             SET email_notifications_enabled = $2,
                 email_frequency = $3
             WHERE id = $1`,
            [configId, enabled, frequency]
        );
    }
}
