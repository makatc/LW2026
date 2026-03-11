exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('bill_versions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        measure_id: { type: 'uuid', notNull: true, references: 'sutra_measures', onDelete: 'CASCADE' },
        version_note: { type: 'varchar(255)' },
        text_content: { type: 'text' },
        pdf_url: { type: 'text' },
        hash: { type: 'varchar(64)' },
        is_current: { type: 'boolean', default: false },
        scraped_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('bill_versions', ['measure_id', 'scraped_at']);
    pgm.createIndex('bill_versions', 'hash');
    pgm.createIndex('bill_versions', ['measure_id', 'is_current']);
};

exports.down = (pgm) => {
    pgm.dropTable('bill_versions');
};
