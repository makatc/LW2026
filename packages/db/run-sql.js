const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});

async function run() {
    try {
        await client.connect();
        console.log('✅ Conectado a la BD');

        const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        await client.query(sql);

        console.log('✅ ¡Esquema creado exitosamente!');
    } catch (err) {
        console.error('❌ Error ejecutando SQL:', err);
    } finally {
        await client.end();
    }
}

run();
