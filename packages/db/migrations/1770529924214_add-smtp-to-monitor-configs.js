/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('monitor_configs', {
        smtp_host: { type: 'varchar(255)', notNull: false },
        smtp_port: { type: 'integer', notNull: false, default: 587 },
        smtp_user: { type: 'varchar(255)', notNull: false },
        smtp_pass: { type: 'varchar(255)', notNull: false },
        smtp_from: { type: 'varchar(255)', notNull: false }
    });
};

exports.down = pgm => {
    pgm.dropColumns('monitor_configs', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from']);
};
