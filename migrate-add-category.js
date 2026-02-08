const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sutra'
});

async function addCategoryColumn() {
    try {
        console.log('🔧 Adding category column to sutra_commissions...\n');

        // Add column if it doesn't exist
        await pool.query(`
            ALTER TABLE sutra_commissions 
            ADD COLUMN IF NOT EXISTS category VARCHAR(50)
        `);

        console.log('✅ Category column added successfully!');

    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('✅ Category column already exists');
        } else {
            console.error('❌ Error:', error.message);
        }
    } finally {
        await pool.end();
    }
}

addCategoryColumn();
