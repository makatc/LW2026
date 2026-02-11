const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // Using bcrypt from sutra-monitor deps

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

async function run() {
    const email = 'admin@legalwatch.pr';
    const password = 'password';
    const name = 'Admin User';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Check if user exists
        const check = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            console.log(`User ${email} already exists. Updating password.`);
            await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);
        } else {
            const res = await pool.query(
                `INSERT INTO users (email, password_hash, name, role) 
                 VALUES ($1, $2, $3, 'ADMIN') 
                 RETURNING id, email`,
                [email, hashedPassword, name]
            );
            console.log(`✅ User created: ${res.rows[0].email} (ID: ${res.rows[0].id})`);
        }
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await pool.end();
    }
}

run();
