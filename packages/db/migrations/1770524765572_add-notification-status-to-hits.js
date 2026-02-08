/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('discovery_hits', {
        notification_status: {
            type: 'varchar(20)',
            default: 'PENDING',
            notNull: true
        },
        notification_sent_at: {
            type: 'timestamp',
            default: null
        }
    });

    pgm.createIndex('discovery_hits', ['notification_status']);
};

exports.down = pgm => {
    pgm.dropIndex('discovery_hits', ['notification_status']);
    pgm.dropColumns('discovery_hits', ['notification_status', 'notification_sent_at']);
};
