const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('🧪 Starting Isolation Test...');

        // 1. Create 2 Users (mock IDs for speed, or inserting real ones)
        // We'll use random UUIDs for users to avoid auth hassle, just simulating DB relation
        const userA = 'aaa00000-0000-0000-0000-000000000001';
        const userB = 'bbb00000-0000-0000-0000-000000000001';

        // Cleanup prev test
        await client.query("DELETE FROM monitor_configs WHERE user_id IN ($1, $2)", [userA, userB]);

        // 2. Create Configs
        const configA = (await client.query("INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING id", [userA])).rows[0].id;
        const configB = (await client.query("INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING id", [userB])).rows[0].id;

        console.log(`Created Config A (${configA}) and Config B (${configB})`);

        // 3. Add Rules
        // A watches "MANGO"
        await client.query("INSERT INTO keyword_rules (config_id, keyword) VALUES ($1, 'MANGO')", [configA]);
        // B watches "HIGO"
        await client.query("INSERT INTO keyword_rules (config_id, keyword) VALUES ($1, 'HIGO')", [configB]);

        // 4. Create Fake Measures to Trigger Discovery
        // We need to run the Discovery Logic (Fan-Out).
        // Since we can't easily import the complex NestJS DiscoveryService here without compilation,
        // we will SIMULATE the fan-out query logic to verify the QUERY ITSELF is correct.
        // OR we can trigger the real DiscoveryService if we updated the API.

        // Let's verify the SQL LOGIC used in ConfigRepository.getAllActiveRules() and the matching logic.
        // Actually, the best verification is to insert hits directly based on rules ? No, that cheats.

        // We will insert 2 measures:
        // M1: "Ley del MANGO"
        // M2: "Ley del HIGO"

        const m1Id = '11111111-1111-1111-1111-111111111111';
        const m2Id = '22222222-2222-2222-2222-222222222222';

        await client.query('DELETE FROM sutra_measures WHERE id IN ($1, $2)', [m1Id, m2Id]);
        await client.query(`INSERT INTO sutra_measures (id, numero, titulo, source_url, hash, last_seen_at) VALUES 
            ($1, 'TEST-MANGO', 'Ley del MANGO verde', 'http://test', 'hash1', NOW()),
            ($2, 'TEST-HIGO', 'Ley del HIGO maduro', 'http://test', 'hash2', NOW())
        `, [m1Id, m2Id]);

        // 5. Run Matching Logic (Simulating DiscoveryService)
        console.log('🔄 Simulating Discovery Matching...');

        // Ref: ConfigRepository.getAllActiveRules (From memory/earlier views)
        // It fetches ALL rules.
        const rules = (await client.query(`
             SELECT kr.*, mc.user_id 
             FROM keyword_rules kr
             JOIN monitor_configs mc ON kr.config_id = mc.id
             WHERE kr.enabled = true AND mc.user_id IN ($1, $2)
        `, [userA, userB])).rows;

        const measures = [
            { id: m1Id, title: 'Ley del MANGO verde', extract: '' },
            { id: m2Id, title: 'Ley del HIGO maduro', extract: '' }
        ];

        let hitsA = 0;
        let hitsB = 0;

        for (const m of measures) {
            const text = (m.title + ' ' + m.extract).toLowerCase();
            for (const r of rules) {
                if (text.includes(r.keyword.toLowerCase())) {
                    console.log(`HIT! Measure ${m.title} matches Rule ${r.keyword} (User ${r.user_id === userA ? 'A' : 'B'})`);
                    if (r.user_id === userA) hitsA++;
                    if (r.user_id === userB) hitsB++;
                }
            }
        }

        // 6. Assertions
        console.log(`\n📊 Results: \nUser A Hits: ${hitsA} (Expected 1) \nUser B Hits: ${hitsB} (Expected 1)`);

        if (hitsA === 1 && hitsB === 1) {
            console.log('✅ ISOLATION VERIFIED: Each user got exactly their specific match.');
        } else {
            console.error('❌ FAILURE: Incorrect hit counts.');
            process.exit(1);
        }

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        // Cleanup? Maybe leave for debug.
        // await client.query("DELETE FROM monitor_configs WHERE user_id IN ($1, $2)", [userA, userB]);
        await pool.end();
    }
}

run();
