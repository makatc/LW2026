exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('legislators', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        full_name: { type: 'varchar(255)', notNull: true },
        chamber: { type: 'varchar(10)', notNull: true }, // 'upper' | 'lower'
        party: { type: 'varchar(50)' },
        district: { type: 'varchar(100)' },
        email: { type: 'varchar(255)' },
        phone: { type: 'varchar(50)' },
        office: { type: 'text' },
        photo_url: { type: 'text' },
        is_active: { type: 'boolean', default: true },
        source_url: { type: 'text' },
        hash: { type: 'varchar(64)' },
        scraped_at: { type: 'timestamp' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.addConstraint('legislators', 'unique_chamber_name', { unique: ['chamber', 'full_name'] });
    pgm.createIndex('legislators', 'chamber');
    pgm.createIndex('legislators', 'party');
    pgm.createIndex('legislators', 'is_active');
};

exports.down = (pgm) => {
    pgm.dropTable('legislators');
};
