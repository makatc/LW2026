// Simple test to trigger commission sync via the API endpoint
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRhMDMxZWNjLTk4ODEtNGQ4ZC1iYjdmLTNlYmNhODdjN2YyOCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3Mzg5NjExMDY3OTksImV4cCI6MTczOTU2NTkwNjc5OX0.HvKqYTRabsCn7lwcgHjBJ4gRZb0W0UQCG8b9RPphZ2w';

console.log('🔄 Testing commission sync endpoint...\n');

// First get a fresh token by logging in
async function login() {
    const res = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@example.com',
            password: 'admin123'
        })
    });

    if (!res.ok) {
        throw new Error(`Login failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.access_token;
}

async function syncCommissions(authToken) {
    console.log('Calling GET /config/commissions/remote...');
    const res = await fetch('http://localhost:3001/config/commissions/remote', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });

    console.log(`Status: ${res.status}`);

    if (res.ok) {
        const data = await res.json();
        console.log(`✅ Sync successful! Got ${data.length} commissions:`);
        data.forEach(c => console.log(`  - ${c.name}`));
        return data;
    } else {
        const text = await res.text();
        console.log(`❌ Error: ${text}`);
    }
}

(async () => {
    try {
        const authToken = await login();
        console.log('✅ Logged in successfully\n');
        await syncCommissions(authToken);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();
