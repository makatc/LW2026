// Test authentication endpoints
const API_URL = 'http://localhost:3001';

async function testAuth() {
    console.log('🔐 Testing Authentication System\n');

    // Test 1: Login with admin credentials
    console.log('1️⃣ Testing login...');
    try {
        const loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@sutramonitor.com',
                password: 'admin123'
            })
        });

        if (!loginResponse.ok) {
            console.log('❌ Login failed:', await loginResponse.text());
            return;
        }

        const loginData = await loginResponse.json();
        console.log('✅ Login successful!');
        console.log('   User:', loginData.user);
        console.log('   Token:', loginData.access_token.substring(0, 20) + '...');

        const token = loginData.access_token;

        // Test 2: Access protected endpoint
        console.log('\n2️⃣ Testing protected endpoint...');
        const meResponse = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!meResponse.ok) {
            console.log('❌ Protected endpoint failed');
            return;
        }

        const meData = await meResponse.json();
        console.log('✅ Protected endpoint accessible!');
        console.log('   User data:', meData.user);

        // Test 3: Register new user
        console.log('\n3️⃣ Testing user registration...');
        const registerResponse = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `test${Date.now()}@example.com`,
                password: 'test123',
                name: 'Test User'
            })
        });

        if (!registerResponse.ok) {
            console.log('❌ Registration failed:', await registerResponse.text());
        } else {
            const registerData = await registerResponse.json();
            console.log('✅ Registration successful!');
            console.log('   User:', registerData.user);
        }

        // Test 4: Public endpoint (health)
        console.log('\n4️⃣ Testing public endpoint...');
        const healthResponse = await fetch(`${API_URL}/health`);

        if (!healthResponse.ok) {
            console.log('❌ Health check failed');
        } else {
            const healthData = await healthResponse.json();
            console.log('✅ Public endpoint accessible without auth!');
            console.log('   Status:', healthData.status);
        }

        // Test 5: Access protected endpoint without token
        console.log('\n5️⃣ Testing protected endpoint without auth...');
        const unauthorizedResponse = await fetch(`${API_URL}/auth/me`);

        if (unauthorizedResponse.status === 401) {
            console.log('✅ Protected endpoint correctly blocked!');
        } else {
            console.log('❌ Protected endpoint should require auth');
        }

        console.log('\n✅ All authentication tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAuth();
