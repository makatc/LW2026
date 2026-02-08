const { Pool } = require('pg');

async function check() {
    const url = process.env.DATABASE_URL;
    console.log('URL defined:', !!url);
    if (url) {
        // mask password
        console.log('URL:', url.replace(/:[^:@]+@/, ':***@'));
    }

    const pool = new Pool({
        connectionString: url || 'postgres://postgres:password@localhost:5433/sutra_monitor'
    });

    try {
        const res = await pool.query('SELECT * FROM sutra_commissions');
        console.log('Commission count:', res.rowCount);
        if (res.rowCount > 0) {
            console.log('Sample:', res.rows[0]);
        } else {
            console.log('No commissions found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

check();
