const { Client } = require('pg');

async function applySchema() {
    const client = new Client({ connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor' });
    await client.connect();

    try {
        console.log('🔄 Applying schema changes for Webhooks...');

        await client.query(`
            ALTER TABLE monitor_configs 
            ADD COLUMN IF NOT EXISTS webhook_alerts TEXT,
            ADD COLUMN IF NOT EXISTS webhook_sutra_updates TEXT;
        `);

        console.log('✅ Webhook columns added to monitor_configs.');
    } catch (e) {
        console.error('❌ Error applying schema:', e);
    } finally {
        await client.end();
    }
}

applySchema();
