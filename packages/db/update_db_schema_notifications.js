const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB...');

        console.log('Adding notification_status column...');
        await client.query(`
            ALTER TABLE discovery_hits 
            ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL;
        `);

        console.log('Adding notification_sent_at column...');
        await client.query(`
            ALTER TABLE discovery_hits 
            ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP DEFAULT NULL;
        `);

        console.log('Creating index on notification_status...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS discovery_hits_notification_status_idx ON discovery_hits(notification_status);
        `);

        console.log('Schema update completed successfully!');
    } catch (err) {
        console.error('Error updating schema:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
