exports.shorthands = undefined;

exports.up = (pgm) => {
    // Extensions
    pgm.createExtension('pgcrypto', { ifNotExists: true });

    // 1. Sutra Commissions
    pgm.createTable('sutra_commissions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'varchar(255)', notNull: true, unique: true },
        slug: { type: 'varchar(100)', notNull: true, unique: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    // 2. Sutra Measures
    pgm.createTable('sutra_measures', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        numero: { type: 'varchar(50)', notNull: true, unique: true }, // e.g., "P. del S. 123"
        titulo: { type: 'text', notNull: true },
        extracto: { type: 'text' },
        comision_id: { type: 'uuid', references: 'sutra_commissions', onDelete: 'SET NULL' },
        fecha: { type: 'date' },
        source_url: { type: 'text', notNull: true },
        hash: { type: 'varchar(64)', notNull: true },
        first_seen_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        last_seen_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.createIndex('sutra_measures', 'comision_id');
    pgm.createIndex('sutra_measures', 'fecha');
    pgm.createIndex('sutra_measures', 'hash');

    // 3. Ingest Runs
    pgm.createTable('ingest_runs', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        started_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        ended_at: { type: 'timestamp' },
        status: { type: 'varchar(20)', notNull: true }, // RUNNING, SUCCESS, FAILED, NEEDS_MANUAL
        measures_found: { type: 'integer', default: 0 },
        measures_new: { type: 'integer', default: 0 },
        measures_updated: { type: 'integer', default: 0 },
        error_message: { type: 'text' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    // 4. Sutra Measure Snapshots
    pgm.createTable('sutra_measure_snapshots', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        measure_id: { type: 'uuid', notNull: true, references: 'sutra_measures', onDelete: 'CASCADE' },
        captured_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        source_url: { type: 'text', notNull: true },
        raw_html_path: { type: 'text' },
        hash: { type: 'varchar(64)', notNull: true },
        change_type: { type: 'varchar(20)' }, // CREATED, UPDATED, NO_CHANGE
        ingest_run_id: { type: 'uuid', references: 'ingest_runs', onDelete: 'SET NULL' },
    });
    pgm.createIndex('sutra_measure_snapshots', ['measure_id', 'captured_at']);

    // 5. Config Tables
    pgm.createTable('monitor_configs', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        // user_id: { type: 'uuid' }, // Added later in migration 1770340000000
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createTable('keyword_rules', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        config_id: { type: 'uuid', notNull: true, references: 'monitor_configs', onDelete: 'CASCADE' },
        keyword: { type: 'varchar(255)', notNull: true },
        enabled: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.createIndex('keyword_rules', 'config_id');

    pgm.createTable('phrase_rules', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        config_id: { type: 'uuid', notNull: true, references: 'monitor_configs', onDelete: 'CASCADE' },
        phrase: { type: 'text', notNull: true },
        enabled: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createTable('commission_follows', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        config_id: { type: 'uuid', notNull: true, references: 'monitor_configs', onDelete: 'CASCADE' },
        commission_id: { type: 'uuid', notNull: true, references: 'sutra_commissions', onDelete: 'CASCADE' },
        enabled: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.addConstraint('commission_follows', 'unique_config_commission', { unique: ['config_id', 'commission_id'] });

    pgm.createTable('watchlist_items', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        config_id: { type: 'uuid', notNull: true, references: 'monitor_configs', onDelete: 'CASCADE' },
        measure_id: { type: 'uuid', references: 'sutra_measures', onDelete: 'CASCADE' },
        measure_number: { type: 'varchar(50)' },
        enabled: { type: 'boolean', default: true },
        added_from: { type: 'varchar(20)', notNull: true }, // MANUAL, DASHBOARD
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.addConstraint('watchlist_items', 'unique_config_measure', { unique: ['config_id', 'measure_id'] });

    // 6. Discovery & Tracking
    pgm.createTable('discovery_hits', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        config_id: { type: 'uuid', notNull: true, references: 'monitor_configs', onDelete: 'CASCADE' },
        measure_id: { type: 'uuid', notNull: true, references: 'sutra_measures', onDelete: 'CASCADE' },
        hit_type: { type: 'varchar(20)', notNull: true }, // KEYWORD, TOPIC, COMMISSION
        rule_id: { type: 'uuid' },
        score: { type: 'decimal(5,2)' },
        evidence: { type: 'text' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.addConstraint('discovery_hits', 'unique_hit', { unique: ['config_id', 'measure_id', 'hit_type', 'rule_id'] });
    pgm.createIndex('discovery_hits', ['config_id', 'created_at']);

    pgm.createTable('measure_events', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        measure_id: { type: 'uuid', notNull: true, references: 'sutra_measures', onDelete: 'CASCADE' },
        event_type: { type: 'varchar(50)', notNull: true },
        title: { type: 'text', notNull: true },
        event_date: { type: 'date' },
        url: { type: 'text' },
        hash: { type: 'varchar(64)', notNull: true },
        first_seen_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.addConstraint('measure_events', 'unique_event_hash', { unique: ['measure_id', 'hash'] });

    pgm.createTable('measure_updates', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        measure_id: { type: 'uuid', notNull: true, references: 'sutra_measures', onDelete: 'CASCADE' },
        update_type: { type: 'varchar(50)', notNull: true },
        summary: { type: 'text', notNull: true },
        captured_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        hash: { type: 'varchar(64)', notNull: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.createIndex('measure_updates', ['measure_id', 'captured_at']);
};

exports.down = (pgm) => {
    // Drop in reverse order
    pgm.dropTable('measure_updates');
    pgm.dropTable('measure_events');
    pgm.dropTable('discovery_hits');
    pgm.dropTable('watchlist_items');
    pgm.dropTable('commission_follows');
    pgm.dropTable('phrase_rules');
    pgm.dropTable('keyword_rules');
    pgm.dropTable('monitor_configs');
    pgm.dropTable('sutra_measure_snapshots');
    pgm.dropTable('ingest_runs');
    pgm.dropTable('sutra_measures');
    pgm.dropTable('sutra_commissions');
    pgm.dropExtension('pgcrypto');
};
