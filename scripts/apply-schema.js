const { Client } = require('pg');

async function applySchema() {
    const client = new Client({ connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor' });
    await client.connect();

    try {
        console.log('🔄 Applying schema changes...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ system_settings table created.');
    } catch (e) {
        console.error('❌ Error applying schema:', e);
    } finally {
        await client.end();
    }
}

applySchema();
