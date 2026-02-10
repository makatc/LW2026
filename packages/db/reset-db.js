const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor',
});
async function reset() {
    try {
        await client.connect();
        console.log('Resetting database...');
        await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');
        console.log('Database reset successful.');
    } catch (err) {
        console.error('Error resetting database:', err);
    } finally {
        await client.end();
    }
}
reset();
