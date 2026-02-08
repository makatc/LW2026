const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRhMDMxZWNjLTk4ODEtNGQ4ZC1iYjdmLTNlYmNhODdjN2YyOCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3Mzg5NjExMDY3OTksImV4cCI6MTczOTU2NTkwNjc5OX0.HvKqYTRabsCn7lwcgHjBJ4gRZb0W0UQCG8b9RPphZ2w';

console.log('\n=== Testing Commission Endpoints ===\n');

async function testEndpoint(name, url) {
    try {
        console.log(`Testing ${name}...`);
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`  Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log(`  ✅ Success - ${Array.isArray(data) ? data.length : 'OK'} items`);
            if (Array.isArray(data) && data.length > 0) {
                console.log(`  First item:`, data[0]);
            }
        } else {
            console.log(`  ❌ Error: ${res.statusText}`);
        }
    } catch (err) {
        console.log(`  ❌ Exception: ${err.message}`);
    }
    console.log('');
}

(async () => {
    await testEndpoint('GET /config/commissions/all', 'http://localhost:3001/config/commissions/all');
    await testEndpoint('GET /config/commissions/followed', 'http://localhost:3001/config/commissions/followed');
})();
