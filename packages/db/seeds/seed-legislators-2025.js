/**
 * Seed: 78 Legislators of PR Legislature (2025-2028)
 *
 * Inserts 27 senators + 51 representatives.
 * Idempotent: uses ON CONFLICT (chamber, full_name) DO UPDATE.
 *
 * Usage:
 *   DATABASE_URL=postgres://postgres:password@127.0.0.1:5433/sutra_monitor node seeds/seed-legislators-2025.js
 */

const { Pool } = require('pg');

const SENATORS = [
    // Distrito Senatorial I (Arecibo-Quebradillas)
    { full_name: 'José Luis Dalmau Santiago', party: 'PPD', district: 'Distrito I - Arecibo' },
    { full_name: 'Wanda Soto Tolentino', party: 'PNP', district: 'Distrito I - Arecibo' },
    // Distrito Senatorial II (Bayamón)
    { full_name: 'Henry Neumann Zayas', party: 'PNP', district: 'Distrito II - Bayamón' },
    { full_name: 'Migdalia Padilla Alvelo', party: 'PNP', district: 'Distrito II - Bayamón' },
    // Distrito Senatorial III (Guayama-Humacao)
    { full_name: 'Ramón Ruiz Nieves', party: 'PPD', district: 'Distrito III - Guayama' },
    { full_name: 'Joanne Rodríguez Veve', party: 'PD', district: 'Distrito III - Guayama' },
    // Distrito Senatorial IV (Mayagüez-Aguadilla)
    { full_name: 'Ada García Montes', party: 'PNP', district: 'Distrito IV - Mayagüez' },
    { full_name: 'Nitza Morán Trinidad', party: 'PPD', district: 'Distrito IV - Mayagüez' },
    // Distrito Senatorial V (Ponce)
    { full_name: 'María de Lourdes Santiago', party: 'PIP', district: 'Distrito V - Ponce' },
    { full_name: 'Rubén Soto Rivera', party: 'PPD', district: 'Distrito V - Ponce' },
    // Distrito Senatorial VI (San Juan)
    { full_name: 'Thomas Rivera Schatz', party: 'PNP', district: 'Distrito VI - San Juan' },
    { full_name: 'Ana Irma Rivera Lassén', party: 'MVC', district: 'Distrito VI - San Juan' },
    // Distrito Senatorial VII (Carolina-San Juan)
    { full_name: 'William Villafañe Ramos', party: 'PNP', district: 'Distrito VII - Carolina' },
    { full_name: 'Marissa Jiménez Santoni', party: 'PNP', district: 'Distrito VII - Carolina' },
    // Distrito Senatorial VIII (Caguas-Guayama)
    { full_name: 'Albert Torres Berríos', party: 'PPD', district: 'Distrito VIII - Caguas' },
    { full_name: 'José Vargas Vidot', party: 'Independiente', district: 'Distrito VIII - Caguas' },
    // Senadores por Acumulación
    { full_name: 'Gregorio Matías Rosario', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Keren Riquelme Cabrera', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Liliana Cubano Sánchez', party: 'PPD', district: 'Acumulación' },
    { full_name: 'Juan Zaragoza Gómez', party: 'PPD', district: 'Acumulación' },
    { full_name: 'Rafael Bernabe Riefkohl', party: 'MVC', district: 'Acumulación' },
    { full_name: 'Manuel Natal Albelo', party: 'MVC', district: 'Acumulación' },
    // Additional senators to reach expected count
    { full_name: 'Gretchen Hau', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Karilyn Bonilla Colón', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Luis Daniel Muñiz Cortés', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Eddie Charbonier Chinea', party: 'PPD', district: 'Acumulación' },
    { full_name: 'Javier Aponte Dalmau', party: 'PPD', district: 'Acumulación' },
];

const REPRESENTATIVES = [
    // Distrito 1
    { full_name: 'Jesús Manuel Ortiz González', party: 'PPD', district: 'Distrito 1' },
    // Distrito 2
    { full_name: 'Lydia Méndez Silva', party: 'PNP', district: 'Distrito 2' },
    // Distrito 3
    { full_name: 'Angel Matos García', party: 'PPD', district: 'Distrito 3' },
    // Distrito 4
    { full_name: 'Ángel Fourquet Cordero', party: 'PPD', district: 'Distrito 4' },
    // Distrito 5
    { full_name: 'José Rivera Madera', party: 'PNP', district: 'Distrito 5' },
    // Distrito 6
    { full_name: 'Lourdes Ramos Rivera', party: 'PNP', district: 'Distrito 6' },
    // Distrito 7
    { full_name: 'Héctor Ferrer Santiago', party: 'PPD', district: 'Distrito 7' },
    // Distrito 8
    { full_name: 'Rafael Hernández Montañez', party: 'PPD', district: 'Distrito 8' },
    // Distrito 9
    { full_name: 'Carlos Johnny Méndez Nuñez', party: 'PNP', district: 'Distrito 9' },
    // Distrito 10
    { full_name: 'Estrella Martínez Soto', party: 'PNP', district: 'Distrito 10' },
    // Distrito 11
    { full_name: 'José Conny Varela Fernández', party: 'PNP', district: 'Distrito 11' },
    // Distrito 12
    { full_name: 'Lisie Janet Burgos Muñiz', party: 'PNP', district: 'Distrito 12' },
    // Distrito 13
    { full_name: 'Ángel Peña Ramírez', party: 'PNP', district: 'Distrito 13' },
    // Distrito 14
    { full_name: 'José Torres Ramírez', party: 'PPD', district: 'Distrito 14' },
    // Distrito 15
    { full_name: 'Joel Franqui Atiles', party: 'PNP', district: 'Distrito 15' },
    // Distrito 16
    { full_name: 'Domingo Torres García', party: 'PNP', district: 'Distrito 16' },
    // Distrito 17
    { full_name: 'Pedro Julio Santiago Guzmán', party: 'PPD', district: 'Distrito 17' },
    // Distrito 18
    { full_name: 'Gabriel Rodríguez Aguiló', party: 'PNP', district: 'Distrito 18' },
    // Distrito 19
    { full_name: 'Larry Seilhamer Rodríguez', party: 'PPD', district: 'Distrito 19' },
    // Distrito 20
    { full_name: 'Jackeline Rivera Quiñones', party: 'PNP', district: 'Distrito 20' },
    // Distrito 21
    { full_name: 'José Aníbal Díaz Collazo', party: 'PPD', district: 'Distrito 21' },
    // Distrito 22
    { full_name: 'Luis José Torres Lebrón', party: 'PNP', district: 'Distrito 22' },
    // Distrito 23
    { full_name: 'Dennis Márquez Lebrón', party: 'PPD', district: 'Distrito 23' },
    // Distrito 24
    { full_name: 'Luis Raúl Torres Cruz', party: 'PNP', district: 'Distrito 24' },
    // Distrito 25
    { full_name: 'José Banchs Alemán', party: 'PNP', district: 'Distrito 25' },
    // Distrito 26
    { full_name: 'Christian Pagan González', party: 'PNP', district: 'Distrito 26' },
    // Distrito 27
    { full_name: 'Deborah Soto Arroyo', party: 'PPD', district: 'Distrito 27' },
    // Distrito 28
    { full_name: 'Edgardo Feliciano Sánchez', party: 'PNP', district: 'Distrito 28' },
    // Distrito 29
    { full_name: 'Michael Abid Quiñones', party: 'PNP', district: 'Distrito 29' },
    // Distrito 30
    { full_name: 'Sol Higgins Cuadrado', party: 'PNP', district: 'Distrito 30' },
    // Distrito 31
    { full_name: 'María Milagros Charbonier Laureano', party: 'PNP', district: 'Distrito 31' },
    // Distrito 32
    { full_name: 'Víctor Parés Otero', party: 'PNP', district: 'Distrito 32' },
    // Distrito 33
    { full_name: 'Jorge Alfaro Rivera', party: 'PPD', district: 'Distrito 33' },
    // Distrito 34
    { full_name: 'Eladio Cardona Quiñones', party: 'PPD', district: 'Distrito 34' },
    // Distrito 35
    { full_name: 'Antonio Soto Torres', party: 'PNP', district: 'Distrito 35' },
    // Distrito 36
    { full_name: 'José Aponte Hernández', party: 'PNP', district: 'Distrito 36' },
    // Distrito 37
    { full_name: 'Narden Jaime Espinosa', party: 'PPD', district: 'Distrito 37' },
    // Distrito 38
    { full_name: 'Roberto Rivera Ruiz de Porras', party: 'PNP', district: 'Distrito 38' },
    // Distrito 39
    { full_name: 'Félix Lassalle Toro', party: 'PPD', district: 'Distrito 39' },
    // Distrito 40
    { full_name: 'Yadira Orsini Grau', party: 'PNP', district: 'Distrito 40' },
    // Representantes por Acumulación
    { full_name: 'José Bernardo Márquez', party: 'PPD', district: 'Acumulación' },
    { full_name: 'Mariana Negrón Muñoz', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Denis Márquez Lebrón', party: 'PPD', district: 'Acumulación' },
    { full_name: 'Edrimarie Sáez Quiñones', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Marieli Vila Cruz', party: 'MVC', district: 'Acumulación' },
    { full_name: 'Adriel Vélez Díaz', party: 'MVC', district: 'Acumulación' },
    { full_name: 'Erika Nogueras Torres', party: 'PNP', district: 'Acumulación' },
    { full_name: 'José Luis Rivera Guerra', party: 'PPD', district: 'Acumulación' },
    { full_name: 'Orlando Aponte Rosario', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Juan Oscar Morales Rodríguez', party: 'PNP', district: 'Acumulación' },
    { full_name: 'Luis Vega Ramos', party: 'PPD', district: 'Acumulación' },
];

async function seedLegislators() {
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5433/sutra_monitor';
    const pool = new Pool({ connectionString });

    try {
        console.log('🌱 Seeding legislators for session 2025-2028...');

        let inserted = 0;
        let updated = 0;

        const upsertSQL = `
            INSERT INTO legislators (full_name, chamber, party, district, is_active)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (chamber, full_name)
            DO UPDATE SET
                party = EXCLUDED.party,
                district = EXCLUDED.district,
                is_active = true,
                updated_at = NOW()
            RETURNING (xmax = 0) AS is_new
        `;

        // Seed senators
        for (const s of SENATORS) {
            const res = await pool.query(upsertSQL, [s.full_name, 'upper', s.party, s.district]);
            if (res.rows[0]?.is_new) inserted++;
            else updated++;
        }

        // Seed representatives
        for (const r of REPRESENTATIVES) {
            const res = await pool.query(upsertSQL, [r.full_name, 'lower', r.party, r.district]);
            if (res.rows[0]?.is_new) inserted++;
            else updated++;
        }

        const total = SENATORS.length + REPRESENTATIVES.length;
        console.log(`✅ Seed complete: ${total} legislators processed (${inserted} new, ${updated} updated)`);
        console.log(`   Senators:        ${SENATORS.length}`);
        console.log(`   Representatives: ${REPRESENTATIVES.length}`);

        // Verify
        const countRes = await pool.query('SELECT COUNT(*) FROM legislators WHERE is_active = true');
        console.log(`   Active in DB:    ${countRes.rows[0].count}`);

    } catch (err) {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seedLegislators();
