const { Pool } = require('pg');
const http = require('http');

// Basic Postgres Client
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

function triggerApi() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/health/discovery',
            method: 'POST'
        }, (res) => {
            console.log(`Response Status: ${res.statusCode}`);
            if (res.statusCode === 201) {
                resolve(true);
            } else {
                reject(new Error(`Status: ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log('🧪 Starting Verification: Discovery Optimization (HTTP Trigger JS)');

    // 1. Reset Cursor to 2 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    await pool.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('discovery_last_run', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1
    `, [pastDate.toISOString()]);

    console.log(`✅ Cursor reset to: ${pastDate.toISOString()}`);

    // 2. Insert a "New" Measure (Yesterday)
    const measureId = '33333333-3333-3333-3333-333333333333';
    const measureDate = new Date();
    measureDate.setDate(measureDate.getDate() - 1);

    // Cleanup first
    await pool.query('DELETE FROM sutra_measures WHERE id = $1', [measureId]);

    await pool.query(`
        INSERT INTO sutra_measures (id, numero, titulo, source_url, hash, updated_at, fecha, first_seen_at)
        VALUES ($1, 'TEST-OPT-JS', 'Ley de Optimización JS', 'http://test', 'hash_test_js', $2, NOW(), $2)
    `, [measureId, measureDate]);
    console.log(`✅ Inserted test measure updated at: ${measureDate.toISOString()}`);

    // 3. Trigger Job via API
    console.log('🔄 Triggering Discovery Job via API...');
    try {
        await triggerApi();
        console.log('✅ API Triggered successfully.');
    } catch (e) {
        console.error('❌ Failed to call API:', e);
        process.exit(1);
    }

    // 4. Verify Cursor Moved
    // Wait a moment for job to finish
    await new Promise(r => setTimeout(r, 2000));

    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'discovery_last_run'");
    const newCursorVal = result.rows[0]?.value;
    const newCursor = new Date(newCursorVal);

    console.log(`🔎 New Cursor: ${newCursor.toISOString()}`);

    if (newCursor.getTime() >= measureDate.getTime()) {
        console.log('✅ SUCCESS: Cursor moved forward to cover the new measure.');
    } else {
        console.log('❌ FAILURE: Cursor did not update correctly.');
        process.exit(1);
    }

    await pool.end();
    process.exit(0);
}

run();
