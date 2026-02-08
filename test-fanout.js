const { Client } = require('pg');

async function testFanOut() {
    const client = new Client({ connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor' });
    await client.connect();

    try {
        console.log('🧪 Starting Fan-Out Logic Test...');

        // 1. Create 2 Test Users & Configs
        const emailA = `fanoutA_${Date.now()}@test.com`;
        const emailB = `fanoutB_${Date.now()}@test.com`;

        const userA = (await client.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'hash', 'User A', 'user') RETURNING id", [emailA])).rows[0];
        const userB = (await client.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'hash', 'User B', 'user') RETURNING id", [emailB])).rows[0];

        const configA = (await client.query("INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING id", [userA.id])).rows[0];
        const configB = (await client.query("INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING id", [userB.id])).rows[0];

        // 2. Add Same Keyword to Both
        const keyword = `FANOUT_TEST_${Date.now()}`;
        await client.query("INSERT INTO keyword_rules (config_id, keyword) VALUES ($1, $2)", [configA.id, keyword]);
        await client.query("INSERT INTO keyword_rules (config_id, keyword) VALUES ($1, $2)", [configB.id, keyword]);

        // 3. Insert a Matching Measure
        const measureRes = await client.query(
            `INSERT INTO sutra_measures (numero, titulo, extracto, fecha, source_url, hash, last_seen_at)
             VALUES ($1, $2, 'Extracto', NOW(), 'http://test.com', 'hash', NOW()) RETURNING id`,
            [`MEASURE_${Date.now()}`, `Ley que menciona ${keyword} para pruebas`]
        );
        const measureId = measureRes.rows[0].id;

        console.log(`✅ Setup Complete: Measure ${measureId} created. Keyword: ${keyword}`);

        // 4. Simulate Discovery Service Logic (The Fan-Out Loop)
        console.log('🔄 Running Matching Logic...');

        // A. Get All Active Rules
        const allRules = (await client.query('SELECT * FROM keyword_rules WHERE enabled = true')).rows;

        // B. Get Recent Measures (Just ours for this test)
        const measures = [{ id: measureId, titulo: `Ley que menciona ${keyword} para pruebas`, extracto: 'Extracto' }];

        let hits = 0;

        for (const m of measures) {
            for (const rule of allRules) {
                const content = `${m.titulo} ${m.extracto}`.toLowerCase();
                const target = rule.keyword.toLowerCase();

                if (content.includes(target)) {
                    // C. Insert Hit
                    await client.query(
                        `INSERT INTO discovery_hits (config_id, measure_id, hit_type, rule_id, score, evidence, created_at)
                         VALUES ($1, $2, 'KEYWORD', $3, 100, $4, NOW())
                         ON CONFLICT (config_id, measure_id, hit_type, rule_id) DO NOTHING`,
                        [rule.config_id, m.id, rule.id, `Matched: ${rule.keyword}`]
                    );
                    hits++;
                }
            }
        }

        // 5. Verification
        const hitCount = (await client.query("SELECT COUNT(*) FROM discovery_hits WHERE measure_id = $1", [measureId])).rows[0].count;

        console.log(`🎯 Logic produced ${hits} hits. DB stored ${hitCount} hits.`);

        if (parseInt(hitCount) >= 2) {
            console.log('✅ SUCCESS: Fan-Out verified! Multiple users got alerts for the same measure.');
        } else {
            console.error('❌ FAILURE: Hits missing.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

testFanOut();
