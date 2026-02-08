exports.shorthands = undefined;

exports.up = pgm => {
    pgm.sql(`
    ALTER TABLE sutra_commissions ALTER COLUMN name TYPE TEXT;
    ALTER TABLE sutra_commissions ALTER COLUMN slug TYPE TEXT;
  `);
};

exports.down = pgm => {
    pgm.sql(`
    ALTER TABLE sutra_commissions ALTER COLUMN name TYPE VARCHAR(255);
    ALTER TABLE sutra_commissions ALTER COLUMN slug TYPE VARCHAR(100);
  `);
};
