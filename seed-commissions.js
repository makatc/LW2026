const { Client } = require('pg');

const commissions = [
    { name: 'Comisión de Hacienda', slug: 'hacienda' },
    { name: 'Comisión de Gobierno', slug: 'gobierno' },
    { name: 'Comisión de Salud', slug: 'salud' },
    { name: 'Comisión de Educación, Turismo y Cultura', slug: 'educacion-turismo-cultura' },
    { name: 'Comisión de Seguridad Pública y Asuntos del Veterano', slug: 'seguridad-publica' },
    { name: 'Comisión de Desarrollo Económico, Servicios Esenciales y Asuntos del Consumidor', slug: 'desarrollo-economico' },
    { name: 'Comisión de Asuntos de Vida y Familia', slug: 'vida-familia' },
    { name: 'Comisión de Nombramientos', slug: 'nombramientos' },
    { name: 'Comisión de Ética', slug: 'etica' },
    { name: 'Comisión de Asuntos Internos', slug: 'asuntos-internos' },
    { name: 'Comisión de lo Jurídico', slug: 'juridico' },
    { name: 'Comisión de Agricultura', slug: 'agricultura' },
    { name: 'Comisión de Asuntos Laborales', slug: 'laborales' },
    { name: 'Comisión de Bienestar Social y Personas con Discapacidad', slug: 'bienestar-social' },
    { name: 'Comisión de Asuntos Municipales y Vivienda', slug: 'municipales-vivienda' },
    { name: 'Comisión de Cooperativismo', slug: 'cooperativismo' },
    { name: 'Comisión de Transportación, Infraestructura y Obras Públicas', slug: 'transportacion-obras-publicas' },
    { name: 'Comisión de Asuntos de la Mujer', slug: 'mujer' },
    { name: 'Comisión de Juventud y Recreación y Deportes', slug: 'juventud-deportes' }
];

async function seedCommissions() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        for (const commission of commissions) {
            await client.query(`
                INSERT INTO sutra_commissions (name, slug)
                VALUES ($1, $2)
                ON CONFLICT (slug) DO NOTHING
            `, [commission.name, commission.slug]);
            process.stdout.write('.');
        }

        console.log('\n✅ Commissions seeded successfully');

        // Verify count
        const res = await client.query('SELECT COUNT(*) FROM sutra_commissions');
        console.log(`📊 Total commissions: ${res.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error seeding commissions:', error);
    } finally {
        await client.end();
    }
}

seedCommissions();
