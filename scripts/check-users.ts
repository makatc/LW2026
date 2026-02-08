import 'dotenv/config';
import { pool } from '@lwbeta/db';

async function listUsers() {
    try {
        const res = await pool.query('SELECT email, role FROM users');
        console.log('Users found:', res.rows.length);
        console.log(res.rows);
    } catch (e) {
        console.error('Error fetching users:', e);
    } finally {
        process.exit();
    }
}

listUsers();
