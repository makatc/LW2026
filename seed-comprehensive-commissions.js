const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sutra'
});

async function seedComprehensiveCommissions() {
    try {
        console.log('🌱 Seeding comprehensive commission list based on SUTRA...\n');

        // Based on the screenshot and typical PR legislative structure
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
            'Comisión de Recreación y Deportes',
            'Comisión de Salud',
            'Comisión de Seguridad Pública',
            'Comisión de Turismo',
            'Comisión de Recursos Naturales',
            'Comisión de Vivienda',
            'Comisión de Transportación',
            'Comisión de Ética',
            'Comisión de Derechos Civiles',
            'Comisión de Asuntos Federales',
            'Comisión de Asuntos del Consumidor',
            'Comisión de Energía',
            'Comisión de Telecomunicaciones',
            'Comisión de Banca',
            'Comisión de Seguros',
            'Comisión de Cooperativas',
            'Comisión de Asuntos del Veterano',
            // Also add space for special and joint commissions
            'Comisión Especial para Asuntos de la Isla Municipio de Vieques',
            'Comisión Especial para Asuntos de Culebra',
            'Comisión Conjunta de Energía'
        ];

        // First, delete all existing
        await pool.query('DELETE FROM sutra_commissions');
        console.log('✅ Cleared existing commissions\n');

        // Insert all commissions
        for (const name of realCommissions) {
            const slug = name
                .toLowerCase()
                .replace(/comisión\s+(de(l)?|conjunta|especial(\s+para)?)\s+/gi, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[áàäâ]/g, 'a')
                .replace(/[éèëê]/g, 'e')
                .replace(/[íìïî]/g, 'i')
                .replace(/[óòöô]/g, 'o')
                .replace(/[úùüû]/g, 'u')
                .replace(/ñ/g, 'n');

            await pool.query(
                'INSERT INTO sutra_commissions (name, slug) VALUES ($1, $2)',
                [name, slug]
            );
            console.log(`  ✅ ${name}`);
        }

        console.log(`\n🎉 Successfully seeded ${realCommissions.length} commissions!`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

seedComprehensiveCommissions();
