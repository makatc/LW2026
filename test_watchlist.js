const https = require('http');

function testWatchlistByNumber(number) {
    const data = JSON.stringify({ number });
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/config/watchlist/by-number',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log(`\n=== Test: ${number} ===`);
            console.log('Status:', res.statusCode);
            console.log('Response:', JSON.parse(body));
        });
    });

    req.on('error', (e) => console.error('Error:', e));
    req.write(data);
    req.end();
}

// Test 1: Existing measure
testWatchlistByNumber('RC0591');

// Test 2: Non-existing measure (pending)
setTimeout(() => testWatchlistByNumber('P. del S. 9999'), 1000);
