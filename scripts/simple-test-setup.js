const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://postgres:password@localhost:5433/sutra_monitor'
});

async function simpleSetup() {
    console.log('🔧 Setup Simple para Test de Alertas\n');

    try {
        // 1. Crear medida de prueba
        console.log('1. Creando medida de prueba...');
        await pool.query(`
            INSERT INTO sutra_measures (numero, titulo, url, fecha_radicacion, created_at, updated_at)
            VALUES ('TEST9999', 'Proyecto para mejorar el sistema de salud pública en Puerto Rico', 
                    'https://sutra.oslpr.org/medidas/TEST9999', CURRENT_DATE, NOW(), NOW())
            ON CONFLICT (numero) DO UPDATE SET titulo = EXCLUDED.titulo, updated_at = NOW()
        `);
        console.log('   ✅ Medida TEST9999 creada\n');

        // 2. Obtener primer usuario y su config
        console.log('2. Obteniendo usuario...');
        const user = await pool.query('SELECT id, email FROM users LIMIT 1');
        if (user.rows.length === 0) {
            console.log('   ❌ No hay usuarios. Crea uno desde el dashboard.');
            return;
        }

        const userId = user.rows[0].id;
        console.log(`   ✅ Usuario: ${user.rows[0].email}\n`);

        // 3. Obtener o crear config
        let config = await pool.query('SELECT id FROM monitor_configs WHERE user_id = $1', [userId]);
        let configId;

        if (config.rows.length === 0) {
            const newConfig = await pool.query(
                'INSERT INTO monitor_configs (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id',
                [userId]
            );
            configId = newConfig.rows[0].id;
            console.log('3. Config creada\n');
        } else {
            configId = config.rows[0].id;
            console.log('3. Config encontrada\n');
        }

        // 4. Agregar keyword si no existe
        console.log('4. Verificando keywords...');
        const kw = await pool.query(
            'SELECT id FROM keyword_rules WHERE config_id = $1 AND keyword = $2',
            [configId, 'salud']
        );

        if (kw.rows.length === 0) {
            await pool.query(
                'INSERT INTO keyword_rules (config_id, keyword, enabled, created_at) VALUES ($1, $2, true, NOW())',
                [configId, 'salud']
            );
            console.log('   ✅ Keyword "salud" agregada\n');
        } else {
            console.log('   ✅ Keyword "salud" ya existe\n');
        }

        // 5. Crear discovery hit
        console.log('5. Creando discovery hit...');
        const measureId = (await pool.query('SELECT id FROM sutra_measures WHERE numero = $1', ['TEST9999'])).rows[0].id;

        await pool.query(`
            INSERT INTO discovery_hits (config_id, measure_id, matched_keywords, matched_phrases, notification_status, created_at)
            VALUES ($1, $2, $3, $4, 'PENDING', NOW())
            ON CONFLICT (config_id, measure_id) DO UPDATE SET notification_status = 'PENDING', created_at = NOW()
        `, [configId, measureId, ['salud'], []]);

        console.log('   ✅ Hit PENDING creado\n');

        // 6. Verificar SMTP
        console.log('6. Verificando configuración SMTP...');
        const smtp = await pool.query(
            'SELECT smtp_host, smtp_port, smtp_from FROM monitor_configs WHERE id = $1',
            [configId]
        );

        if (smtp.rows[0].smtp_host) {
            console.log(`   ✅ SMTP configurado: ${smtp.rows[0].smtp_host}:${smtp.rows[0].smtp_port}`);
            console.log(`   From: ${smtp.rows[0].smtp_from}\n`);
        } else {
            console.log('   ⚠️  SMTP no configurado\n');
        }

        console.log('✅ Setup completado!\n');
        console.log('📋 Resumen:');
        console.log(`   - Usuario: ${user.rows[0].email}`);
        console.log(`   - Config ID: ${configId}`);
        console.log(`   - Medida: TEST9999`);
        console.log(`   - Keyword: salud`);
        console.log(`   - Hit: PENDING\n`);

        console.log('📧 Próximos pasos:');
        console.log('   1. Si no tienes SMTP configurado:');
        console.log('      → Ve a http://localhost:3000/config');
        console.log('      → Configura SMTP y guarda');
        console.log('   2. Espera 5 minutos (cron job automático)');
        console.log('   3. O ejecuta: curl -X POST http://localhost:3001/notifications/process');
        console.log('   4. Verifica tu email\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

simpleSetup();
