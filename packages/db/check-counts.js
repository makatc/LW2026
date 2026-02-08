const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});

async function run() {
    try {
        await client.connect();
        const resCom = await client.query('SELECT count(*) FROM sutra_commissions');
        const resMeas = await client.query('SELECT count(*) FROM sutra_measures');

        console.log('Commissions:', resCom.rows[0].count);
        console.log('Measures:', resMeas.rows[0].count);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
