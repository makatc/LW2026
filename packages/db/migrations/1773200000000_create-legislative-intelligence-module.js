/**
 * Migration: Legislative Intelligence Module
 *
 * Creates all tables and enums for the Grupo A module:
 * - legislator_staff, interactions, interaction_participants,
 *   interaction_measures, interaction_attachments,
 *   legislator_measure_positions, legislator_intelligence_profiles,
 *   legislator_historical_data, legislator_committee_memberships_v2
 *
 * DECISION: The existing `legislators` table is preserved as-is.
 * The existing `committee_memberships` table from migration 1773113100000
 * is also preserved. We create `legislator_committee_memberships_v2` as an
 * extended version with role enum, committee_name text (not FK), to match
 * the spec without breaking existing scraper data.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
    // ─── PostgreSQL Native Enums ──────────────────────────────────────────────

    pgm.createType('contact_type_enum', [
        'reunion_presencial',
        'llamada',
        'correo',
        'evento',
    ]);

    pgm.createType('position_enum', [
        'a_favor',
        'en_contra',
        'indeciso',
        'no_se_pronuncio',
    ]);

    pgm.createType('position_type_enum', [
        'confirmada',
        'sugerida_por_ia',
    ]);

    pgm.createType('committee_role_enum', [
        'presidente',
        'vicepresidente',
        'miembro',
    ]);

    // ─── legislator_committee_memberships_v2 ──────────────────────────────────
    // Extended committee memberships with role enum and text committee_name
    // (the original committee_memberships table references committees by FK;
    //  this one is more flexible for CRM use)

    pgm.createTable('legislator_committee_memberships_v2', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
        },
        committee_name: { type: 'varchar(255)', notNull: true },
        role: { type: 'committee_role_enum', notNull: true, default: 'miembro' },
    });

    pgm.createIndex('legislator_committee_memberships_v2', 'legislator_id');

    // ─── legislator_staff ─────────────────────────────────────────────────────

    pgm.createTable('legislator_staff', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
        },
        name: { type: 'varchar(255)', notNull: true },
        title: { type: 'varchar(255)', notNull: true },
        email: { type: 'varchar(255)' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('legislator_staff', 'legislator_id');

    // ─── interactions ─────────────────────────────────────────────────────────

    pgm.createTable('interactions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
        },
        organization_id: { type: 'uuid' }, // FK for multi-tenant future
        contact_type: { type: 'contact_type_enum', notNull: true },
        interaction_date: { type: 'timestamptz', notNull: true },
        notes: { type: 'text' },
        next_step_description: { type: 'text' },
        next_step_date: { type: 'date' },
        created_by: { type: 'uuid' }, // user id
        is_deleted: { type: 'boolean', notNull: true, default: false },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('interactions', 'legislator_id');
    pgm.createIndex('interactions', 'interaction_date');
    pgm.createIndex('interactions', 'organization_id');
    pgm.createIndex('interactions', 'created_by');

    // ─── interaction_participants ──────────────────────────────────────────────

    pgm.createTable('interaction_participants', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        interaction_id: {
            type: 'uuid',
            notNull: true,
            references: '"interactions"',
            onDelete: 'CASCADE',
        },
        staff_id: {
            type: 'uuid',
            references: '"legislator_staff"',
            onDelete: 'SET NULL',
        },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
        },
        custom_name: { type: 'varchar(255)' },
    });

    pgm.createIndex('interaction_participants', 'interaction_id');
    pgm.createIndex('interaction_participants', 'legislator_id');

    // ─── interaction_measures ─────────────────────────────────────────────────

    pgm.createTable('interaction_measures', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        interaction_id: {
            type: 'uuid',
            notNull: true,
            references: '"interactions"',
            onDelete: 'CASCADE',
        },
        measure_id: { type: 'uuid' },               // FK to sutra_measures if exists
        measure_reference: { type: 'varchar(255)' }, // free text if not in portfolio
        position_expressed: { type: 'position_enum' },
    });

    pgm.createIndex('interaction_measures', 'interaction_id');
    pgm.createIndex('interaction_measures', 'measure_id');

    // ─── interaction_attachments ──────────────────────────────────────────────

    pgm.createTable('interaction_attachments', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        interaction_id: {
            type: 'uuid',
            notNull: true,
            references: '"interactions"',
            onDelete: 'CASCADE',
        },
        file_name: { type: 'varchar(512)', notNull: true },
        file_path: { type: 'varchar(1024)', notNull: true },
        file_size: { type: 'integer' },
        mime_type: { type: 'varchar(128)' },
        uploaded_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('interaction_attachments', 'interaction_id');

    // ─── legislator_measure_positions ──────────────────────────────────────────

    pgm.createTable('legislator_measure_positions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
        },
        measure_id: { type: 'uuid', notNull: true },
        position: { type: 'position_enum', notNull: true },
        position_type: { type: 'position_type_enum', notNull: true },
        confidence_score: { type: 'float' },
        source_interaction_id: {
            type: 'uuid',
            references: '"interactions"',
            onDelete: 'SET NULL',
        },
        is_superseded: { type: 'boolean', notNull: true, default: false },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('legislator_measure_positions', 'legislator_id');
    pgm.createIndex('legislator_measure_positions', 'measure_id');
    pgm.createIndex('legislator_measure_positions', ['legislator_id', 'measure_id']);

    // ─── legislator_intelligence_profiles ──────────────────────────────────────

    pgm.createTable('legislator_intelligence_profiles', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
            unique: true,
        },
        thematic_footprint: { type: 'text' },
        topic_positions: { type: 'jsonb' },
        key_priorities: { type: 'jsonb' },             // string[]
        voting_consistency: { type: 'jsonb' },          // { score, description }
        raw_profile_json: { type: 'jsonb' },            // full Gemini response
        last_generated_at: { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('legislator_intelligence_profiles', 'legislator_id');

    // ─── legislator_historical_data ───────────────────────────────────────────

    pgm.createTable('legislator_historical_data', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        legislator_id: {
            type: 'uuid',
            notNull: true,
            references: '"legislators"',
            onDelete: 'CASCADE',
            unique: true,
        },
        authored_measures: { type: 'jsonb' },           // array of measures
        coauthored_measures: { type: 'jsonb' },         // array of measures
        voting_record: { type: 'jsonb' },               // array of votes
        raw_data: { type: 'jsonb' },                    // full scraped data
        source: { type: 'varchar(50)' },                // 'oslpr' | 'manual'
        last_ingested_at: { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('legislator_historical_data', 'legislator_id');
};

exports.down = (pgm) => {
    // Drop tables in reverse dependency order
    pgm.dropTable('legislator_historical_data', { ifExists: true });
    pgm.dropTable('legislator_intelligence_profiles', { ifExists: true });
    pgm.dropTable('legislator_measure_positions', { ifExists: true });
    pgm.dropTable('interaction_attachments', { ifExists: true });
    pgm.dropTable('interaction_measures', { ifExists: true });
    pgm.dropTable('interaction_participants', { ifExists: true });
    pgm.dropTable('interactions', { ifExists: true });
    pgm.dropTable('legislator_staff', { ifExists: true });
    pgm.dropTable('legislator_committee_memberships_v2', { ifExists: true });

    // Drop enums
    pgm.dropType('committee_role_enum', { ifExists: true });
    pgm.dropType('position_type_enum', { ifExists: true });
    pgm.dropType('position_enum', { ifExists: true });
    pgm.dropType('contact_type_enum', { ifExists: true });
};
