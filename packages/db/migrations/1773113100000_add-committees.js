exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('committees', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'varchar(255)', notNull: true },
        slug: { type: 'varchar(255)' },
        chamber: { type: 'varchar(10)' }, // 'upper' | 'lower' | 'joint'
        type: { type: 'varchar(50)', default: "'standing'" },
        chair_id: { type: 'uuid', references: 'legislators', onDelete: 'SET NULL' },
        sutra_commission_id: { type: 'uuid', references: 'sutra_commissions', onDelete: 'SET NULL' },
        source_url: { type: 'text' },
        is_active: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.addConstraint('committees', 'unique_committee_chamber_name', { unique: ['chamber', 'name'] });
    pgm.createIndex('committees', 'chamber');
    pgm.createIndex('committees', 'chair_id');

    pgm.createTable('committee_memberships', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        committee_id: { type: 'uuid', notNull: true, references: 'committees', onDelete: 'CASCADE' },
        legislator_id: { type: 'uuid', notNull: true, references: 'legislators', onDelete: 'CASCADE' },
        role: { type: 'varchar(20)', default: "'member'" }, // 'chair' | 'vice-chair' | 'member'
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.addConstraint('committee_memberships', 'unique_committee_legislator', { unique: ['committee_id', 'legislator_id'] });
    pgm.createIndex('committee_memberships', 'committee_id');
    pgm.createIndex('committee_memberships', 'legislator_id');
};

exports.down = (pgm) => {
    pgm.dropTable('committee_memberships');
    pgm.dropTable('committees');
};
