const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/sutra_monitor' });
client.connect()
    .then(() => client.query('ALTER TABLE sutra_commissions ALTER COLUMN name TYPE TEXT; ALTER TABLE sutra_commissions ALTER COLUMN slug TYPE TEXT;'))
    .then(() => console.log('Fixed schema'))
    .catch(e => console.error('Error:', e.message))
    .finally(() => client.end());
