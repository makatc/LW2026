const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});
client.connect()
    .then(async () => {
        console.log('✅ ¡CONEXIÓN EXITOSA!');
        await client.query('CREATE TABLE IF NOT EXISTS test_table (id serial primary key)');
        console.log('✅ ¡TABLA CREADA!');
        await client.query('DROP TABLE test_table');
        console.log('✅ ¡TABLA BORRADA!');
        client.end();
    })
    .catch(err => {
        console.error('❌ ERROR:', err.message);
        client.end();
    });
