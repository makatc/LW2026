const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor'
});

async function verifySmtpMigration() {
    try {
        console.log('🔍 Verificando migración SMTP...\n');

        // 1. Verify columns exist
        console.log('1. Verificando columnas SMTP en monitor_configs:');
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'monitor_configs' 
            AND column_name LIKE 'smtp%'
            ORDER BY column_name;
        `);

        if (columnsResult.rows.length === 0) {
            console.log('   ❌ No se encontraron columnas SMTP');
            return;
        }

        columnsResult.rows.forEach(row => {
            console.log(`   ✅ ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
        });

        // 2. Check if there's a config record
        console.log('\n2. Verificando registros en monitor_configs:');
        const configResult = await pool.query('SELECT id, user_id, smtp_host, smtp_port FROM monitor_configs LIMIT 1');

        if (configResult.rows.length === 0) {
            console.log('   ⚠️  No hay registros en monitor_configs');
            console.log('   Creando un registro de prueba...');

            const insertResult = await pool.query(`
                INSERT INTO monitor_configs (user_id, smtp_host, smtp_port, smtp_user, smtp_from)
                VALUES (NULL, 'smtp.example.com', 587, 'test@example.com', 'Test <test@example.com>')
                RETURNING id, smtp_host, smtp_port;
            `);

            console.log(`   ✅ Registro creado: ID=${insertResult.rows[0].id}, Host=${insertResult.rows[0].smtp_host}`);
        } else {
            console.log(`   ✅ Encontrado registro: ID=${configResult.rows[0].id}`);
            console.log(`      SMTP Host: ${configResult.rows[0].smtp_host || '(no configurado)'}`);
            console.log(`      SMTP Port: ${configResult.rows[0].smtp_port || '(no configurado)'}`);
        }

        // 3. Verify old system_settings table (should still exist but not used for SMTP)
        console.log('\n3. Verificando tabla system_settings (antigua):');
        const systemSettingsResult = await pool.query(`
            SELECT key, value FROM system_settings WHERE key LIKE 'smtp%' ORDER BY key;
        `);

        if (systemSettingsResult.rows.length > 0) {
            console.log('   ⚠️  Todavía hay configuración SMTP en system_settings (antigua):');
            systemSettingsResult.rows.forEach(row => {
                console.log(`      - ${row.key}: ${row.value}`);
            });
            console.log('   💡 Considera migrar estos valores a monitor_configs si son necesarios');
        } else {
            console.log('   ✅ No hay configuración SMTP en system_settings');
        }

        console.log('\n✅ Verificación completada exitosamente!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

verifySmtpMigration();
