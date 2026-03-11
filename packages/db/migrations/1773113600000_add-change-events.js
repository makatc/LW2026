exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('change_events', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        entity_type: { type: 'varchar(50)', notNull: true },   // 'bill' | 'legislator' | 'committee' | 'vote' | 'bill_version'
        entity_id: { type: 'uuid' },
        event_type: { type: 'varchar(20)', notNull: true },    // 'created' | 'updated'
        scraper_name: { type: 'varchar(50)' },
        summary: { type: 'text', notNull: true, default: '' },
        payload: { type: 'jsonb', notNull: true, default: '{}' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('change_events', ['entity_type', 'entity_id']);
    pgm.createIndex('change_events', 'created_at', { order: 'DESC' });
    pgm.createIndex('change_events', 'event_type');
};

exports.down = (pgm) => {
    pgm.dropTable('change_events');
};
