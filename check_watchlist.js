const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor' });

client.connect()
    .then(() => client.query('SELECT * FROM watchlist_items ORDER BY created_at DESC LIMIT 5'))
    .then(res => {
        console.log('\n✅ Watchlist items:');
        res.rows.forEach(r => {
            const identifier = r.measure_number || r.measure_id;
            console.log(`  - ${identifier} (${r.added_from}) ${r.measure_id ? '[Resolved]' : '[Pending]'}`);
        });
        client.end();
    })
    .catch(e => {
        console.error('❌ Error:', e.message);
        client.end();
    });
