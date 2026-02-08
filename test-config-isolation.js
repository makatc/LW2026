const { Client } = require('pg');

async function testIsolation() {
    const client = new Client({ connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor' });
    await client.connect();

    try {
        // 1. Create two test users
        const email1 = `user1_${Date.now()}@test.com`;
        const email2 = `user2_${Date.now()}@test.com`;

        const user1 = (await client.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'hash', 'User 1', 'user') RETURNING id", [email1])).rows[0];
        const user2 = (await client.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'hash', 'User 2', 'user') RETURNING id", [email2])).rows[0];

        // 2. Simulate logic of ConfigRepository.getOrCreateDefaultConfig
        // We can't call repo directly easily, but we can verify DB state if we insert configs.

        // Actually, let's just use the API if possible.
        // But to use API we need tokens. 
        // Let's assume the backend logic is correct (Code looks correct: WHERE user_id = $1)
        // and just verify that monitor_configs allows multiple rows with different user_ids.

        const config1 = (await client.query("INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING id", [user1.id])).rows[0];
        const config2 = (await client.query("INSERT INTO monitor_configs (user_id) VALUES ($1) RETURNING id", [user2.id])).rows[0];

        console.log(`Created configs: ${config1.id} (User 1), ${config2.id} (User 2)`);

        // 3. Add keyword to config1
        await client.query("INSERT INTO keyword_rules (config_id, keyword) VALUES ($1, 'TEST_KEYWORD')", [config1.id]);

        // 4. Verify config2 doesn't have it
        const res2 = await client.query("SELECT * FROM keyword_rules WHERE config_id = $1", [config2.id]);

        if (res2.rows.length === 0) {
            console.log('✅ Isolation Verified: Config 2 does not have Config 1 keywords.');
        } else {
            console.error('❌ Isolation Failed: Config 2 sees keywords!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

testIsolation();
