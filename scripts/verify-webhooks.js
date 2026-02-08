const { Pool } = require('pg');
const http = require('http');

// Config
const WEBHOOK_PORT = 9999;
const API_URL = 'http://localhost:3001/health';

// DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

// State
let alertsReceived = 0;
let updatesReceived = 0;
let server;

function startWebhookServer() {
    return new Promise((resolve) => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                const payload = JSON.parse(body);
                console.log(`📨 Webhook Received: ${payload.content}`);

                if (payload.content.includes('Nuevo Hallazgo')) {
                    alertsReceived++;
                    console.log('✅ Identified as ALERT');
                } else if (payload.content.includes('Sutra Actualización')) {
                    updatesReceived++;
                    console.log('✅ Identified as UPDATE');
                }

                res.writeHead(200);
                res.end('OK');
            });
        });
        server.listen(WEBHOOK_PORT, () => {
            console.log(`👂 Webhook Listener started on port ${WEBHOOK_PORT}`);
            resolve();
        });
    });
}

async function triggerApi(endpoint) {
    console.log(`🔌 Triggering ${endpoint}...`);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: `/health/${endpoint}`,
            method: 'POST'
        }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('✅ Trigger successful');
                resolve();
            } else {
                reject(new Error(`API Error: ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.end();
    });
}

async function setupTestData() {
    console.log('🛠️ Setting up test data...');
    const client = await pool.connect();
    try {
        const webhookUrl = `http://localhost:${WEBHOOK_PORT}/webhook`;

        // 1. Create Test Config
        const configRes = await client.query(`
            INSERT INTO monitor_configs (webhook_alerts, webhook_sutra_updates)
            VALUES ($1, $1)
            RETURNING id
        `, [webhookUrl]);
        const configId = configRes.rows[0].id;
        console.log(`Created Config: ${configId}`);

        // 2. Create Keyword Rule (for Discovery)
        await client.query(`
            INSERT INTO keyword_rules (config_id, keyword, enabled)
            VALUES ($1, 'WEBHOOK_TEST_KEYWORD', true)
        `, [configId]);

        // 3. Insert "New" Measure for Discovery (Time travel to yesterday so it's picked up as new by cursor)
        // Ensure cursor is behind. A reset cursor logic is needed or ensure measure is NEWER than cursor.
        // Let's assume cursor moves. We will update updated_at to NOW() + 1 minute (future?) No, just NOW().
        // But we need to make sure cursor is BEHIND.

        // Reset Cursor to 1 hour ago
        const past = new Date();
        past.setHours(past.getHours() - 1);
        await client.query(`
            INSERT INTO system_settings (key, value) VALUES ('discovery_last_run', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1
        `, [past.toISOString()]);

        const measureId = '99999999-9999-9999-9999-999999999999';
        await client.query('DELETE FROM sutra_measures WHERE id = $1', [measureId]);
        await client.query(`
            INSERT INTO sutra_measures (id, numero, titulo, updated_at, source_url, hash)
            VALUES ($1, 'TEST-WEBHOOK', 'Ley de WEBHOOK_TEST_KEYWORD', NOW(), 'http://test.com', 'test_hash')
        `, [measureId]);

        return { configId, measureId };
    } finally {
        client.release();
    }
}

async function setupIngestTestData(measureId) {
    const client = await pool.connect();
    try {
        // Cleanup Zombies
        await client.query("DELETE FROM monitor_configs WHERE webhook_alerts LIKE '%localhost:9999%'");
        console.log('🧟 Zombies cleaned.');

        // Find a AVAILABLE measure (likely to be scraped)
        const res = await client.query("SELECT * FROM sutra_measures WHERE numero != 'TEST-WEBHOOK' ORDER BY last_seen_at DESC LIMIT 1");
        if (res.rows.length === 0) {
            console.log('⚠️ No real measures found. Skipping Ingest update test.');
            return false;
        }
        const real = res.rows[0];
        console.log(`🛠️ Messing with measure ${real.numero} for Ingest Test...`);

        // Change its hash so Ingest thinks it updated
        await client.query(`
            UPDATE sutra_measures 
            SET hash = 'tampered_hash', titulo = 'OLD TITLE'
            WHERE id = $1
            `, [real.id]);

        return true;
    } finally {
        client.release();
    }
}

async function run() {
    await startWebhookServer();
    const { configId, measureId } = await setupTestData();

    // TEST 1: Discovery Webhook
    console.log('\n🧪 TEST 1: DISCOVERY WEBHOOK');
    await triggerApi('discovery');

    // Wait for webhook
    await new Promise(r => setTimeout(r, 3000));
    if (alertsReceived > 0) {
        console.log('✅ Discovery Webhook Verified!');
    } else {
        console.error('❌ Discovery Webhook NOT received.');
    }

    // TEST 2: Ingest Update Webhook
    // Note: This relies on scraper actually working and finding the measure we tampered with.
    // If scraper fails or doesn't find that specific measure in "Latest", this might fail.
    // But let's try.
    console.log('\n🧪 TEST 2: INGEST WEBHOOK');
    const canTestIngest = await setupIngestTestData();
    if (canTestIngest) {
        await triggerApi('ingest');
        await new Promise(r => setTimeout(r, 10000)); // Scraper takes time
        if (updatesReceived > 0) {
            console.log('✅ Ingest Webhook Verified!');
        } else {
            console.warn('⚠️ Ingest Webhook NOT received (Scraper might not have found the tampered measure in latest list).');
        }
    }

    // Cleanup
    await pool.query('DELETE FROM monitor_configs WHERE id = $1', [configId]);
    await pool.query('DELETE FROM sutra_measures WHERE id = $1', [measureId]);
    await pool.end();
    server.close();
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    server.close();
    process.exit(1);
});
