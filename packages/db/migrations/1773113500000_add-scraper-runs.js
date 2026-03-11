exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('scraper_runs', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        scraper_name: { type: 'varchar(100)', notNull: true },
        status: { type: 'varchar(20)', notNull: true }, // 'RUNNING' | 'SUCCESS' | 'FAILED'
        records_scraped: { type: 'integer', default: 0 },
        records_new: { type: 'integer', default: 0 },
        records_updated: { type: 'integer', default: 0 },
        error_message: { type: 'text' },
        started_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        ended_at: { type: 'timestamp' },
    });

    pgm.createIndex('scraper_runs', ['scraper_name', 'started_at']);
    pgm.createIndex('scraper_runs', 'status');
};

exports.down = (pgm) => {
    pgm.dropTable('scraper_runs');
};
