
import { pool } from './packages/db/src';

async function check() {
    try {
        const res = await pool.query('SELECT count(*) FROM sutra_commissions');
        console.log('Count:', res.rows[0].count);

        const categories = await pool.query('SELECT category, count(*) FROM sutra_commissions GROUP BY category');
        console.table(categories.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
