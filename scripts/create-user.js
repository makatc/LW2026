const { Pool } = require('pg');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is installed in root or db package? 
// If not, we might need to use the one in apps/sutra-monitor/node_modules
// Let's assume we run this via pnpm --filter @lwbeta/sutra-monitor exec...

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

async function run() {
    const email = process.argv[2];
    const password = process.argv[3];
    const name = process.argv[4] || 'Test User';

    if (!email || !password) {
        console.log('Usage: node create-user.js <email> <password> [name]');
        process.exit(1);
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const res = await pool.query(
            `INSERT INTO users (email, password_hash, name, role) 
             VALUES ($1, $2, $3, 'USER') 
             RETURNING id, email`,
            [email, hashedPassword, name]
        );
        console.log(`✅ User created: ${res.rows[0].email} (ID: ${res.rows[0].id})`);
    } catch (e) {
        if (e.code === '23505') {
            console.log('⚠️  User already exists.');
        } else {
            console.error('❌ Error:', e);
        }
    } finally {
        await pool.end();
    }
}

run();
