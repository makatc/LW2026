// Quick test to load official commissions

async function login() {
    const res = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@example.com',
            password: 'admin123'
        })
    });
    const data = await res.json();
    return data.access_token;
}

(async () => {
    try {
        console.log('Logging in...');
        const token = await login();

        console.log('Loading official commissions...');
        const res = await fetch('http://localhost:3001/config/commissions/seed-official', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        console.log(`✅ Loaded ${data.length} commissions`);
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
