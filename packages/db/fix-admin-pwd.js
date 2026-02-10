const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});
async function fix() {
    try {
        await client.connect();
        const hash = '$2b$10$Ch7dXpUc6BqqUXuNRAn0JeEnR93N0XJiNhlFpfITWRFcecKdVyw6a';
        await client.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@sutramonitor.com'", [hash]);
        console.log('✅ Admin password fixed!');
    } catch (err) {
        console.error('❌ Error fixing password:', err);
    } finally {
        await client.end();
    }
}
fix();
