const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor' });

client.connect()
    .then(async () => {
        const res = await client.query('SELECT * FROM sutra_measures LIMIT 1');
        if (res.rows.length > 0) {
            console.log('Columns:', Object.keys(res.rows[0]));
        } else {
            console.log('No rows found, cannot see columns.');
            // Fallback: check information_schema
            const schema = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sutra_measures'");
            console.log('Schema Columns:', schema.rows.map(r => r.column_name));
        }
        client.end();
    })
    .catch(e => {
        console.error('Error FULL:', e);
        client.end();
    });
