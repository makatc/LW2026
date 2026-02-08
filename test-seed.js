// Test de endpoint de seed con mejor logging
const API_URL = 'http://localhost:3001';

async function test() {
    try {
        // Login
        console.log('1. Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@example.com',
                password: 'admin123'
            })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', loginRes.status, await loginRes.text());
            return;
        }

        const { access_token } = await loginRes.json();
        console.log('✅ Login successful\n');

        // Seed
        console.log('2. Calling seed endpoint...');
        const seedRes = await fetch(`${API_URL}/config/commissions/seed-official`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Response status: ${seedRes.status}`);

        if (!seedRes.ok) {
            const errorText = await seedRes.text();
            console.error('❌ Seed failed:', errorText);
            return;
        }

        const result = await seedRes.json();
        console.log(`✅ Success! Loaded ${result.length} commissions`);

        // Check database
        console.log('\n3. Verifying commissions...');
        const listRes = await fetch(`${API_URL}/config/commissions/all`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const all = await listRes.json();
        console.log(`\nTotal commissions in DB: ${all.length}`);
        console.log('\nFirst 5:');
        all.slice(0, 5).forEach(c => console.log(`  - ${c.name} [${c.category || 'no category'}]`));

    } catch (error) {
        console.error(' ❌ Error:', error.message);
        console.error(error);
    }
}

test();
