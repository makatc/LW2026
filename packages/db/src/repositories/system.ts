import { pool } from '../client';

export class SystemRepository {
    async getSetting(key: string): Promise<string | null> {
        const result = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
        return result.rows[0]?.value || null;
    }

    async setSetting(key: string, value: string): Promise<void> {
        await pool.query(
            `INSERT INTO system_settings (key, value, updated_at) 
             VALUES ($1, $2, NOW()) 
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
        );
    }

    // Helper for discovery cursor
    async getDiscoveryCursor(): Promise<Date> {
        const val = await this.getSetting('discovery_last_run');
        if (!val) {
            // Default to 24 hours ago if never run
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        }
        return new Date(val);
    }

    async setDiscoveryCursor(date: Date): Promise<void> {
        await this.setSetting('discovery_last_run', date.toISOString());
    }
}
