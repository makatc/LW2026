const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sutra'
});

async function query(text, params) {
    return pool.query(text, params);
}


async function seedRealCommissions() {
    try {
        console.log('🌱 Seeding real commissions from SUTRA...\n');

        // Based on the screenshot provided, these are the actual commissions
        const realCommissions = [
            'Comisión de Gobierno',
            'Comisión de Hacienda',
            'Comisión de Lo Jurídico',
            'Comisión de Agricultura',
            'Comisión de Asuntos Internos',
            'Comisión de Asuntos de la Mujer',
            'Comisión de Asuntos de la Juventud',
            'Comisión de Adultos Mayores y Bienestar Social',
            'Comisión del Trabajo y Asuntos Laborales',
            'Comisión de Asuntos Municipales',
            'Comisión de Desarrollo Económico',
            'Comisión de Pequeños y Medianos Negocios',
            'Comisión de Educación',
            'Comisión de Recreación y Deportes'
        ];

        // First, delete all existing commissions
        await query('DELETE FROM sutra_commissions');
        console.log('✅ Cleared existing commissions\n');

        // Insert real commissions
        for (const name of realCommissions) {
            const slug = name
                .toLowerCase()
                .replace(/comisión de(l)?/gi, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[áàäâ]/g, 'a')
                .replace(/[éèëê]/g, 'e')
                .replace(/[íìïî]/g, 'i')
                .replace(/[óòöô]/g, 'o')
                .replace(/[úùüû]/g, 'u')
                .replace(/ñ/g, 'n');

            await query(
                'INSERT INTO sutra_commissions (name, slug) VALUES ($1, $2)',
                [name, slug]
            );
            console.log(`  ✅ ${name}`);
        }

        console.log(`\n🎉 Successfully seeded ${realCommissions.length} commissions!`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

seedRealCommissions();
