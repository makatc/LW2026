import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { pool } from '@lwbeta/db';

@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
    private readonly logger = new Logger(DatabaseMigrationService.name);

    async onModuleInit() {
        await this.runMigrations();
    }

    private async runMigrations() {
        try {
            this.logger.log('🚀 Starting Database Migration & Seeding...');

            this.logger.log('1. Adding category column...');
            await pool.query(`
                ALTER TABLE sutra_commissions 
                ADD COLUMN IF NOT EXISTS category VARCHAR(50)
            `);
            this.logger.log('✅ Schema updated (category column)');

            // Fix sutra_measures missing columns (required by bills scraper + bills API)
            this.logger.log('1b. Adding missing columns to sutra_measures...');
            const measureCols = [
                { name: 'bill_type', type: 'TEXT' },
                { name: 'status', type: 'TEXT' },
                { name: 'author', type: 'TEXT' },
                { name: 'author_names', type: 'TEXT[]' },
                { name: 'author_ids', type: 'UUID[]' },
                { name: 'actions', type: 'JSONB' },
                { name: 'hash', type: 'TEXT' },
                { name: 'last_seen_at', type: 'TIMESTAMPTZ' },
            ];
            for (const col of measureCols) {
                await pool.query(`ALTER TABLE sutra_measures ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            }
            this.logger.log('✅ sutra_measures schema updated');

            // 2. CLEAR ALL EXISTING COMMISSIONS (to remove old/bad data)
            await pool.query('DELETE FROM sutra_commissions');
            this.logger.log('🧹 Cleared old commissions');

            // 3. SEED OFFICIAL COMMISSIONS (2025-2028)
            const commissions = {
                'Comisiones Conjuntas': [
                    'Comisión Conjunta de la Asamblea Legislativa para la Revisión del Sistema Electoral de Puerto Rico',
                    'Comisión Conjunta para la Revisión Continua del Código Penal y para la Reforma de las Leyes Penales',
                    'Comisión Conjunta para la Revisión e Implementación de Reglamentos Administrativos',
                    'Comisión Conjunta para las Alianzas Público-Privadas de la Asamblea Legislativa',
                    'Comisión Conjunta Permanente para la Revisión y Reforma del Código Civil de Puerto Rico',
                    'Comisión Conjunta sobre Informes Especiales del Contralor',
                    'Comisión Conjunta sobre Mitigación, Adaptación y Resiliencia al Cambio Climático',
                    'Comisión Especial Conjunta de Fondos Legislativos para Impacto Comunitario'
                ],
                'Cámara de Representantes': [
                    'Comisión de Adultos Mayores y Bienestar Social',
                    'Comisión de Agricultura',
                    'Comisión de Asuntos de la Juventud',
                    'Comisión de Asuntos de la Mujer',
                    'Comisión de Asuntos del Consumidor',
                    'Comisión de Asuntos Federales y Veteranos',
                    'Comisión de Asuntos Internos',
                    'Comisión de Asuntos Municipales',
                    'Comisión de Banca, Seguros y Comercio',
                    'Comisión de Cooperativismo',
                    'Comisión de Desarrollo Económico',
                    'Comisión de Educación',
                    'Comisión de Gobierno',
                    'Comisión de Hacienda',
                    'Comisión de Lo Jurídico',
                    'Comisión de Pequeños y Medianos Negocios',
                    'Comisión de Recreación y Deportes',
                    'Comisión de Recursos Naturales',
                    'Comisión de Reorganización, Eficiencia y Diligencia',
                    'Comisión de Salud',
                    'Comisión de Seguridad Pública',
                    'Comisión de Sistemas de Retiro',
                    'Comisión de Transportación e Infraestructura',
                    'Comisión de Turismo',
                    'Comisión de Vivienda y Desarrollo Urbano',
                    'Comisión del Trabajo y Asuntos Laborales',
                    'Comisión de la Región Central',
                    'Comisión de la Región Este',
                    'Comisión de la Región Este Central',
                    'Comisión de la Región Metro',
                    'Comisión de la Región Norte',
                    'Comisión de la Región Oeste',
                    'Comisión de la Región Sur'
                ],
                'Senado': [
                    'Comisión de Agricultura',
                    'Comisión de Asuntos Internos',
                    'Comisión de Asuntos Municipales',
                    'Comisión de Ciencia, Tecnología e Inteligencia Artificial',
                    'Comisión de Desarrollo Económico, Pequeños Negocios, Banca, Comercio, Seguros y Cooperativismo',
                    'Comisión de Educación, Arte y Cultura',
                    'Comisión de Ética',
                    'Comisión de Familia, Asuntos de la Mujer, Personas de la Tercera Edad y Población con Diversidad Funcional e Impedimentos',
                    'Comisión de Gobierno',
                    'Comisión de Hacienda, Presupuesto y PROMESA',
                    'Comisión de Innovación, Reforma y Nombramientos',
                    'Comisión de Juventud, Recreación y Deportes',
                    'Comisión De Lo Jurídico',
                    'Comisión de Planificación, Permisos, Infraestructura y Urbanismo',
                    'Comisión de Relaciones Federales y Viabilización del Mandato del Pueblo para la Solución del Status',
                    'Comisión de Salud',
                    'Comisión de Seguridad Pública y Asuntos del Veterano',
                    'Comisión De Trabajo y Relaciones Laborales',
                    'Comisión de Transportación, Telecomunicaciones, Servicios Públicos y Asuntos del Consumidor',
                    'Comisión de Turismo, Recursos Naturales y Ambientales',
                    'Comisión de Vivienda y Bienestar Social'
                ]
            };

            let count = 0;
            for (const [category, names] of Object.entries(commissions)) {
                const categoryPrefix = category.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');

                for (const name of names) {
                    const nameSlug = name.toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
                        .replace(/[^a-z0-9]+/g, '-') // replace non-alphanum with dashes
                        .replace(/^-+|-+$/g, ''); // trim dashes
                    const slug = `${categoryPrefix}-${nameSlug}`;

                    await pool.query(
                        `INSERT INTO sutra_commissions (name, slug, category) 
                         VALUES ($1, $2, $3)
                         ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, category = EXCLUDED.category`,
                        [name, slug, category]
                    );
                    count++;
                }
            }

            this.logger.log(`🎉 Successfully seeded ${count} official commissions`);

            // ══════════════════════════════════════════════════════════════
            // LEGISLATIVE INTELLIGENCE MODULE — Tables & Enums
            // ══════════════════════════════════════════════════════════════
            this.logger.log('📦 Creating Legislative Intelligence Module tables...');

            // 1. Enums (CREATE TYPE IF NOT EXISTS via DO block)
            await pool.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type_enum') THEN
                        CREATE TYPE contact_type_enum AS ENUM (
                            'reunion_presencial', 'llamada', 'correo', 'evento'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'position_enum') THEN
                        CREATE TYPE position_enum AS ENUM (
                            'a_favor', 'en_contra', 'indeciso', 'no_se_pronuncio'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'position_type_enum') THEN
                        CREATE TYPE position_type_enum AS ENUM (
                            'confirmada', 'sugerida_por_ia'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_status_enum') THEN
                        CREATE TYPE interaction_status_enum AS ENUM (
                            'completada', 'pendiente', 'cancelada'
                        );
                    END IF;
                END $$;
            `);
            this.logger.log('✅ Enums created');

            // 2. legislator_staff
            await pool.query(`
                CREATE TABLE IF NOT EXISTS legislator_staff (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legislator_id UUID NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    title TEXT,
                    email TEXT,
                    phone TEXT,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 3. interactions
            await pool.query(`
                CREATE TABLE IF NOT EXISTS interactions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legislator_id UUID NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
                    contact_type contact_type_enum NOT NULL,
                    interaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    notes TEXT,
                    next_step_description TEXT,
                    next_step_date DATE,
                    status interaction_status_enum DEFAULT 'completada',
                    created_by UUID,
                    organization_id UUID,
                    is_deleted BOOLEAN DEFAULT false,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 4. interaction_participants
            await pool.query(`
                CREATE TABLE IF NOT EXISTS interaction_participants (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
                    legislator_id UUID REFERENCES legislators(id),
                    staff_id UUID REFERENCES legislator_staff(id),
                    custom_name TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 5. interaction_measures
            await pool.query(`
                CREATE TABLE IF NOT EXISTS interaction_measures (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
                    measure_id UUID,
                    measure_reference TEXT,
                    position_expressed position_enum,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 6. interaction_attachments
            await pool.query(`
                CREATE TABLE IF NOT EXISTS interaction_attachments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    mime_type TEXT,
                    size_bytes INTEGER,
                    storage_path TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 7. legislator_measure_positions
            await pool.query(`
                CREATE TABLE IF NOT EXISTS legislator_measure_positions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legislator_id UUID NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
                    measure_id UUID,
                    position position_enum NOT NULL,
                    position_type position_type_enum NOT NULL DEFAULT 'confirmada',
                    confidence_score REAL,
                    source_interaction_id UUID REFERENCES interactions(id),
                    is_superseded BOOLEAN DEFAULT false,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 8. legislator_intelligence_profiles
            await pool.query(`
                CREATE TABLE IF NOT EXISTS legislator_intelligence_profiles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legislator_id UUID NOT NULL UNIQUE REFERENCES legislators(id) ON DELETE CASCADE,
                    thematic_footprint TEXT,
                    topic_positions JSONB DEFAULT '{}'::jsonb,
                    key_priorities JSONB DEFAULT '[]'::jsonb,
                    voting_consistency JSONB DEFAULT '{}'::jsonb,
                    raw_profile_json JSONB,
                    last_generated_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 9. legislator_historical_data
            await pool.query(`
                CREATE TABLE IF NOT EXISTS legislator_historical_data (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legislator_id UUID NOT NULL UNIQUE REFERENCES legislators(id) ON DELETE CASCADE,
                    authored_measures JSONB DEFAULT '[]'::jsonb,
                    coauthored_measures JSONB DEFAULT '[]'::jsonb,
                    voting_record JSONB DEFAULT '[]'::jsonb,
                    raw_data JSONB DEFAULT '{}'::jsonb,
                    sources JSONB DEFAULT '[]'::jsonb,
                    last_ingested_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);

            // 10. legislator_committee_memberships_v2
            await pool.query(`
                CREATE TABLE IF NOT EXISTS legislator_committee_memberships_v2 (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legislator_id UUID NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
                    committee_name TEXT NOT NULL,
                    chamber TEXT,
                    role TEXT DEFAULT 'miembro',
                    session TEXT DEFAULT '2025-2028',
                    source TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(legislator_id, committee_name, session)
                )
            `);

            // Create indexes for performance
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_interactions_legislator ON interactions(legislator_id);
                CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(interaction_date);
                CREATE INDEX IF NOT EXISTS idx_interaction_participants_interaction ON interaction_participants(interaction_id);
                CREATE INDEX IF NOT EXISTS idx_interaction_measures_interaction ON interaction_measures(interaction_id);
                CREATE INDEX IF NOT EXISTS idx_legislator_positions_legislator ON legislator_measure_positions(legislator_id);
                CREATE INDEX IF NOT EXISTS idx_legislator_positions_measure ON legislator_measure_positions(measure_id);
                CREATE INDEX IF NOT EXISTS idx_legislator_staff_legislator ON legislator_staff(legislator_id);
                CREATE INDEX IF NOT EXISTS idx_historical_data_legislator ON legislator_historical_data(legislator_id);
            `);

            this.logger.log('✅ All Legislative Intelligence Module tables created');

            // ══════════════════════════════════════════════════════════════
            // SEED 78 LEGISLATORS (if not present)
            // ══════════════════════════════════════════════════════════════
            // Ensure unique constraint for idempotent seeding
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_legislators_full_name
                ON legislators(full_name)
            `);
            // Clean up garbage data from scraper (e.g. "Representantes", "Ver Todos Los...")
            await pool.query(`
                DELETE FROM legislators
                WHERE full_name IN ('Representantes', 'Ver Todos Los Representates', 'Ver Todos Los Senadores', 'Senadores')
                   OR full_name IS NULL
                   OR LENGTH(full_name) < 5
            `);

            const legCount = await pool.query('SELECT COUNT(*) FROM legislators WHERE is_active = true');
            const activeCount = parseInt(legCount.rows[0].count, 10);
            if (activeCount < 50) {
                this.logger.log(`⚠️ Only ${activeCount} active legislators found. Seeding 78 legislators...`);
                await this.seedLegislators();
            } else {
                this.logger.log(`✅ ${activeCount} active legislators already present`);
            }

        } catch (error: any) {
            this.logger.error('❌ Migration/Seeding failed:', error.message);
        }
    }

    /**
     * Seed 78 legislators for the 2025-2028 session.
     * 27 senators + 51 representatives.
     */
    private async seedLegislators() {
        const senators = [
            { name: 'Thomas Rivera Schatz', party: 'PNP', district: 'Acumulación' },
            { name: 'José Luis Dalmau Santiago', party: 'PPD', district: 'Acumulación' },
            { name: 'Marially González Huertas', party: 'PNP', district: 'Acumulación' },
            { name: 'Wanda del Valle Correa', party: 'PNP', district: 'Bayamón' },
            { name: 'Henry Neumann Zayas', party: 'PNP', district: 'Carolina' },
            { name: 'Keren Riquelme Cabrera', party: 'PNP', district: 'Guaynabo' },
            { name: 'Joanne Rodríguez Veve', party: 'PD', district: 'Acumulación' },
            { name: 'William Villafañe Ramos', party: 'PNP', district: 'Humacao' },
            { name: 'Gregorio Matías Rosario', party: 'PNP', district: 'Ponce' },
            { name: 'Ada García de Costas', party: 'PNP', district: 'Arecibo' },
            { name: 'Migdalia González Arroyo', party: 'PPD', district: 'Acumulación' },
            { name: 'Rubén Soto Rivera', party: 'PPD', district: 'Acumulación' },
            { name: 'Juan Zaragoza Gómez', party: 'PPD', district: 'Acumulación' },
            { name: 'María de Lourdes Santiago', party: 'PIP', district: 'Acumulación' },
            { name: 'Ana Irma Rivera Lassén', party: 'MVC', district: 'Acumulación' },
            { name: 'Rafael Bernabe Riefkohl', party: 'MVC', district: 'Acumulación' },
            { name: 'Nitza Morán Trinidad', party: 'PNP', district: 'Mayagüez' },
            { name: 'Ramón Ruiz Nieves', party: 'PPD', district: 'Acumulación' },
            { name: 'José Vargas Vidot', party: 'Independiente', district: 'Acumulación' },
            { name: 'Gretchen Hau Irizarry', party: 'PNP', district: 'Acumulación' },
            { name: 'Carlos Rodríguez Mateo', party: 'PNP', district: 'Acumulación' },
            { name: 'Elizabeth Rosa Vélez', party: 'PPD', district: 'Acumulación' },
            { name: 'Franqui Atiles Ramos', party: 'PPD', district: 'Acumulación' },
            { name: 'Eileen Vélez Vega', party: 'PNP', district: 'Acumulación' },
            { name: 'Albert Torres Berríos', party: 'PPD', district: 'Acumulación' },
            { name: 'Nelson Cruz Rivera', party: 'PPD', district: 'Acumulación' },
            { name: 'Eliezer Molina', party: 'Independiente', district: 'Acumulación' },
        ];

        const representatives = [
            { name: 'Carlos Johnny Méndez', party: 'PNP', district: '57' },
            { name: 'José Aponte Hernández', party: 'PNP', district: '37' },
            { name: 'Ángel Matos García', party: 'PPD', district: '40' },
            { name: 'Joel Franqui Atiles', party: 'PPD', district: '29' },
            { name: 'Jorge Alfaro Rivera', party: 'PNP', district: '22' },
            { name: 'Estrella Martínez Soto', party: 'PPD', district: 'Acumulación' },
            { name: 'Jesús Manuel Ortiz', party: 'PPD', district: '1' },
            { name: 'José Bernardo Márquez', party: 'PPD', district: '5' },
            { name: 'Luis Raúl Torres Cruz', party: 'PNP', district: '10' },
            { name: 'Edgardo Feliciano Sánchez', party: 'PNP', district: '31' },
            { name: 'Gabriel Rodríguez Aguiló', party: 'PNP', district: 'Acumulación' },
            { name: 'Lourdes Ramos Rivera', party: 'PNP', district: '24' },
            { name: 'José Rivera Madera', party: 'PPD', district: '8' },
            { name: 'Luis Pérez Ortiz', party: 'PNP', district: '9' },
            { name: 'Ramón Luis Cruz Burgos', party: 'PNP', district: '36' },
            { name: 'Sol Higgins Cuadrado', party: 'PNP', district: '28' },
            { name: 'PJ Ortiz Angleró', party: 'PNP', district: '26' },
            { name: 'Michael Abid Quiñones', party: 'PNP', district: '12' },
            { name: 'Lisie Janet Burgos Muñiz', party: 'PNP', district: '20' },
            { name: 'Rafael Hernández Montañez', party: 'PPD', district: 'Acumulación' },
            { name: 'Denis Márquez Lebrón', party: 'MVC', district: 'Acumulación' },
            { name: 'Mariana Nogales Molinelli', party: 'MVC', district: 'Acumulación' },
            { name: 'Héctor Torres Calderón', party: 'PNP', district: '11' },
            { name: 'Lydia Méndez Silva', party: 'PNP', district: '21' },
            { name: 'Ángel Fourquet Cordero', party: 'PNP', district: '27' },
            { name: 'José Torres Ramírez', party: 'PNP', district: '35' },
            { name: 'Roberto Rivera Ruiz de Porras', party: 'PNP', district: '38' },
            { name: 'Orlando Aponte Rosario', party: 'PPD', district: '3' },
            { name: 'Víctor Parés Otero', party: 'PNP', district: '2' },
            { name: 'José Meléndez Ortiz', party: 'PNP', district: '6' },
            { name: 'Carmen Maldonado González', party: 'PPD', district: '18' },
            { name: 'Domingo Torres García', party: 'PPD', district: '32' },
            { name: 'Deborah Soto Arroyo', party: 'PNP', district: '16' },
            { name: 'José Aníbal Díaz Collazo', party: 'PPD', district: '13' },
            { name: 'Eladio Cardona Quiles', party: 'PNP', district: '25' },
            { name: 'Ángel Bulerín Ramos', party: 'PPD', district: '30' },
            { name: 'Rafael Torruellas Santiago', party: 'PNP', district: '39' },
            { name: 'Christian Sobrino Vega', party: 'PNP', district: '14' },
            { name: 'Wanda Soto Tolentino', party: 'PNP', district: '17' },
            { name: 'José Santiago Rivera', party: 'PPD', district: '7' },
            { name: 'Yashira Lebrón Rodríguez', party: 'PNP', district: '4' },
            { name: 'Jessie Cortés Ramos', party: 'PPD', district: '19' },
            { name: 'Arlene Soto Lozada', party: 'PPD', district: '23' },
            { name: 'Néstor Alonso Vega', party: 'PNP', district: '33' },
            { name: 'Luis Berdiel Rivera', party: 'PNP', district: '15' },
            { name: 'Manuel Natal Albelo', party: 'MVC', district: 'Acumulación' },
            { name: 'Eva Prados Rodríguez', party: 'MVC', district: 'Acumulación' },
            { name: 'Nivfasthi Calderón Silva', party: 'PNP', district: '34' },
            { name: 'Myriam Varela Fernández', party: 'PNP', district: 'Acumulación' },
            { name: 'José Pérez Cordero', party: 'PPD', district: 'Acumulación' },
            { name: 'Carlos López Sierra', party: 'PNP', district: 'Acumulación' },
        ];

        for (const s of senators) {
            await pool.query(
                `INSERT INTO legislators (full_name, chamber, party, district, is_active, scraped_at)
                 VALUES ($1, 'upper', $2, $3, true, NOW())
                 ON CONFLICT (full_name) DO UPDATE SET
                     chamber = 'upper', party = EXCLUDED.party, district = EXCLUDED.district, is_active = true`,
                [s.name, s.party, s.district]
            );
        }
        for (const r of representatives) {
            await pool.query(
                `INSERT INTO legislators (full_name, chamber, party, district, is_active, scraped_at)
                 VALUES ($1, 'lower', $2, $3, true, NOW())
                 ON CONFLICT (full_name) DO UPDATE SET
                     chamber = 'lower', party = EXCLUDED.party, district = EXCLUDED.district, is_active = true`,
                [r.name, r.party, r.district]
            );
        }

        this.logger.log(`✅ Seeded ${senators.length} senators + ${representatives.length} representatives`);
    }
}
