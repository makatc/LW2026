const { Client } = require('pg');
const client = new Client('postgresql://postgres:password@localhost:5433/sutra_monitor');
async function run() {
    await client.connect();
    await client.query("UPDATE users SET password_hash = '$2b$10$QbouT.SeFBNjV4H26okhb.gF1uvt4oWQvgv9Mu7LyOmTnnt42pZZ06' WHERE email = 'admin@sutramonitor.com'");
    console.log('✅ Admin password updated');
    await client.end();
}
run().catch(console.error);
