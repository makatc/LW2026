const { Client } = require('pg');

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                email varchar(255) NOT NULL UNIQUE,
                password_hash text NOT NULL,
                name varchar(255) NOT NULL,
                role varchar(50) NOT NULL DEFAULT 'user',
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT NOW(),
                updated_at timestamptz NOT NULL DEFAULT NOW(),
                last_login_at timestamptz
            )
        `);
        console.log('✅ Created users table');

        // Create index
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        console.log('✅ Created email index');

        // Add user_id to monitor_configs
        await client.query(`
            ALTER TABLE monitor_configs 
            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('✅ Added user_id to monitor_configs');

        // Create default admin user
        // Password: admin123 (pre-hashed with bcrypt)
        const adminPasswordHash = '$2b$10$1YgV0d95QFyMATJYQTeAJ.EFTOEZVUTM.rwWajzJef45kklYsd62/G';

        await client.query(`
            INSERT INTO users (email, password_hash, name, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO NOTHING
        `, ['admin@sutramonitor.com', adminPasswordHash, 'Admin User', 'admin']);
        console.log('✅ Created default admin user (email: admin@sutramonitor.com, password: admin123)');

        await client.end();
        console.log('\n✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await client.end();
        process.exit(1);
    }
}

runMigration();
