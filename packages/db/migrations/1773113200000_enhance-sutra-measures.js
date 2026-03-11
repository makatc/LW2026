exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumns('sutra_measures', {
        bill_type: { type: 'varchar(50)' },       // 'PS', 'PC', 'RS', 'RC', 'RCS', 'RCC', etc.
        status: { type: 'varchar(100)' },          // current status text
        actions: { type: 'jsonb', default: pgm.func("'[]'") },
        author_names: { type: 'text[]' },           // raw author name strings
        author_ids: { type: 'uuid[]' },             // resolved legislator UUIDs
        subjects: { type: 'text[]' },               // subject tags
        classification: { type: 'text[]' },         // bill/resolution/joint-resolution
    });

    pgm.createIndex('sutra_measures', 'bill_type');
    pgm.createIndex('sutra_measures', 'status');
};

exports.down = (pgm) => {
    pgm.dropColumns('sutra_measures', ['bill_type', 'status', 'actions', 'author_names', 'author_ids', 'subjects', 'classification']);
};
