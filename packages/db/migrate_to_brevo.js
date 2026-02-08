const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
});

async function migrate() {
    console.log('🚀 Starting Brevo migration...\n');

    try {
        // 1. Drop old SMTP columns
        console.log('1. Removing old SMTP columns...');
        await pool.query(`
            ALTER TABLE monitor_configs 
            DROP COLUMN IF EXISTS smtp_host,
            DROP COLUMN IF EXISTS smtp_port,
            DROP COLUMN IF EXISTS smtp_user,
            DROP COLUMN IF EXISTS smtp_pass,
            DROP COLUMN IF EXISTS smtp_from
        `);
        console.log('   ✅ SMTP columns removed\n');

        // 2. Add new email preference columns
        console.log('2. Adding email preference columns...');
        await pool.query(`
            ALTER TABLE monitor_configs
            ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS email_frequency VARCHAR(20) DEFAULT 'daily'
        `);
        console.log('   ✅ Email preference columns added\n');

        // 3. Add constraint for frequency
        console.log('3. Adding frequency constraint...');
        await pool.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'monitor_configs_email_frequency_check'
                ) THEN
                    ALTER TABLE monitor_configs
                    ADD CONSTRAINT monitor_configs_email_frequency_check 
                    CHECK (email_frequency IN ('daily', 'weekly'));
                END IF;
            END $$;
        `);
        console.log('   ✅ Frequency constraint added\n');

        // 4. Verify migration
        console.log('4. Verifying migration...');
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'monitor_configs' 
            AND column_name IN ('email_notifications_enabled', 'email_frequency')
            ORDER BY column_name
        `);

        console.log('   Columns found:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

migrate();
