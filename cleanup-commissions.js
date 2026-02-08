const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sutra'
});

async function cleanupCommissions() {
    try {
        console.log('🧹 Cleaning up invalid commissions...\n');

        // First, let's see what we have
        const allResult = await pool.query('SELECT id, name FROM sutra_commissions ORDER BY name');
        console.log(`Total commissions in DB: ${allResult.rows.length}\n`);

        // Show all current entries
        console.log('Current entries:');
        allResult.rows.forEach(row => {
            const isValid = row.name.startsWith('Comisión de');
            console.log(`  ${isValid ? '✅' : '❌'} ${row.name}`);
        });

        // Delete invalid ones
        const deleteResult = await pool.query(
            "DELETE FROM sutra_commissions WHERE name NOT LIKE 'Comisión de%' RETURNING name"
        );

        console.log(`\n🗑️  Deleted ${deleteResult.rowCount} invalid entries:`);
        deleteResult.rows.forEach(row => {
            console.log(`  - ${row.name}`);
        });

        // Show final count
        const finalResult = await pool.query('SELECT COUNT(*) FROM sutra_commissions');
        console.log(`\n✅ Final count: ${finalResult.rows[0].count} valid commissions`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

cleanupCommissions();
