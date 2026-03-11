exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('votes', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        measure_id: { type: 'uuid', references: 'sutra_measures', onDelete: 'SET NULL' },
        vote_date: { type: 'date' },
        motion_text: { type: 'text' },
        result: { type: 'varchar(10)' }, // 'pass' | 'fail'
        yea_count: { type: 'integer', default: 0 },
        nay_count: { type: 'integer', default: 0 },
        abstain_count: { type: 'integer', default: 0 },
        other_count: { type: 'integer', default: 0 },
        chamber: { type: 'varchar(10)' }, // 'upper' | 'lower'
        hash: { type: 'varchar(64)', unique: true },
        source_url: { type: 'text' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('votes', 'measure_id');
    pgm.createIndex('votes', 'vote_date');

    pgm.createTable('individual_votes', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        vote_id: { type: 'uuid', notNull: true, references: 'votes', onDelete: 'CASCADE' },
        legislator_id: { type: 'uuid', references: 'legislators', onDelete: 'SET NULL' },
        legislator_name: { type: 'varchar(255)' }, // raw name fallback
        option: { type: 'varchar(10)', notNull: true }, // 'yea' | 'nay' | 'abstain' | 'other'
    });

    pgm.addConstraint('individual_votes', 'unique_vote_legislator', { unique: ['vote_id', 'legislator_id'] });
    pgm.createIndex('individual_votes', 'vote_id');
    pgm.createIndex('individual_votes', 'legislator_id');
};

exports.down = (pgm) => {
    pgm.dropTable('individual_votes');
    pgm.dropTable('votes');
};
