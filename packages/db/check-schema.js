const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});

async function describe() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'monitor_configs'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
describe();
