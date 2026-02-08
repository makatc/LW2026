const { Client } = require('pg');
const client = new Client('postgresql://postgres:password@localhost:5433/sutra_monitor');
async function run() {
    await client.connect();
    const res = await client.query("SELECT password_hash FROM users WHERE email = 'admin2@sutramonitor.com'");
    const hash = res.rows[0].password_hash;
    await client.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@sutramonitor.com'", [hash]);
    console.log('✅ Admin password fixed using hash from admin2');
    await client.end();
}
run().catch(console.error);
