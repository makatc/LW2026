const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});

async function test() {
    try {
        await client.connect();
        console.log('✅ Conexión exitosa!');
        const res = await client.query('SELECT NOW()');
        console.log('Hora del servidor:', res.rows[0].now);
        await client.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

test();
