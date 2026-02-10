const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});
async function check() {
    try {
        await client.connect();
        const res = await client.query("SELECT email, name, role FROM users");
        console.log('Users in DB:', res.rows);
    } catch (err) {
        console.error('❌ Error checking users:', err);
    } finally {
        await client.end();
    }
}
check();
