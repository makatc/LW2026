const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

pool.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'discovery_hits' 
    AND is_nullable = 'NO'
    ORDER BY ordinal_position
`).then(res => {
    console.log('Columnas NOT NULL en discovery_hits:');
    res.rows.forEach(r => {
        console.log(`- ${r.column_name} (default: ${r.column_default || 'NONE'})`);
    });
    pool.end();
}).catch(err => {
    console.error(err);
    pool.end();
});
