const { Client } = require('pg');

const sampleMeasures = [
    {
        numero: 'P. del S. 1420',
        titulo: 'Ley para Regular el Uso de Inteligencia Artificial en el Gobierno',
        extracto: 'Para establecer regulaciones sobre el uso de sistemas de inteligencia artificial en agencias gubernamentales.',
        commission: 'Comisión de Gobierno',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123456'
    },
    {
        numero: 'P. de la C. 890',
        titulo: 'Ley de Incentivos para Energía Renovable',
        extracto: 'Para proveer incentivos contributivos a proyectos de energía solar y eólica.',
        commission: 'Comisión de Recursos Naturales',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123457'
    },
    {
        numero: 'R. C. del S. 55',
        titulo: 'Resolución para Investigar Sistema de Salud',
        extracto: 'Para investigar las deficiencias en el sistema de salud público.',
        commission: 'Comisión de Salud',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123458'
    },
    {
        numero: 'P. del S. 1100',
        titulo: 'Ley de Protección de Datos Personales',
        extracto: 'Para establecer un marco legal para la protección de datos personales de los ciudadanos.',
        commission: 'Comisión de Gobierno',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123459'
    },
    {
        numero: 'P. de la C. 750',
        titulo: 'Ley de Educación Digital',
        extracto: 'Para modernizar el sistema educativo mediante tecnología digital.',
        commission: 'Comisión de Educación',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123460'
    },
    {
        numero: 'R. del S. 200',
        titulo: 'Resolución sobre Cambio Climático',
        extracto: 'Para establecer metas de reducción de emisiones de carbono.',
        commission: 'Comisión de Recursos Naturales',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123461'
    },
    {
        numero: 'P. del S. 980',
        titulo: 'Ley de Transparencia Gubernamental',
        extracto: 'Para fortalecer los mecanismos de transparencia en el gobierno.',
        commission: 'Comisión de Gobierno',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123462'
    },
    {
        numero: 'P. de la C. 1200',
        titulo: 'Ley de Desarrollo Económico',
        extracto: 'Para promover el desarrollo económico mediante incentivos a pequeñas empresas.',
        commission: 'Comisión de Desarrollo Económico',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123463'
    },
    {
        numero: 'R. C. de la C. 88',
        titulo: 'Resolución de Investigación de Corrupción',
        extracto: 'Para investigar alegaciones de corrupción en contratos públicos.',
        commission: 'Comisión de Gobierno',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123464'
    },
    {
        numero: 'P. del S. 1550',
        titulo: 'Ley de Protección Ambiental Marina',
        extracto: 'Para proteger los ecosistemas marinos y costeros de Puerto Rico.',
        commission: 'Comisión de Recursos Naturales',
        url: 'https://sutra.oslpr.org/osl/esutra/MeasuresDetail.aspx?ID=123465'
    }
];

async function seedDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/sutra_monitor'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        for (const measure of sampleMeasures) {
            // Insert commission
            const commSlug = measure.commission.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const commRes = await client.query(
                `INSERT INTO sutra_commissions (name, slug) VALUES ($1, $2)
                 ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
                 RETURNING id`,
                [measure.commission, commSlug]
            );
            const commissionId = commRes.rows[0].id;

            // Insert measure
            const hash = require('crypto').createHash('sha256').update(JSON.stringify(measure)).digest('hex');
            await client.query(
                `INSERT INTO sutra_measures 
                 (numero, titulo, extracto, comision_id, fecha, source_url, hash, last_seen_at)
                 VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW())
                 ON CONFLICT (numero) DO UPDATE SET
                 titulo = EXCLUDED.titulo,
                 extracto = EXCLUDED.extracto,
                 comision_id = EXCLUDED.comision_id,
                 last_seen_at = NOW(),
                 hash = EXCLUDED.hash`,
                [measure.numero, measure.titulo, measure.extracto, commissionId, measure.url, hash]
            );

            console.log(`✅ Seeded: ${measure.numero}`);
        }

        // Get counts
        const measuresCount = await client.query('SELECT COUNT(*) FROM sutra_measures');
        const commissionsCount = await client.query('SELECT COUNT(*) FROM sutra_commissions');

        console.log('\n📊 Database Summary:');
        console.log(`   Measures: ${measuresCount.rows[0].count}`);
        console.log(`   Commissions: ${commissionsCount.rows[0].count}`);

        await client.end();
        console.log('\n✅ Seed completed successfully');
    } catch (error) {
        console.error('❌ Seed failed:', error);
        await client.end();
        process.exit(1);
    }
}

seedDatabase();
