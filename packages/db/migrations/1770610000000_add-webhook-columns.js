/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumns('monitor_configs', {
        webhook_alerts: { type: 'text' },
        webhook_sutra_updates: { type: 'text' }
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('monitor_configs', ['webhook_alerts', 'webhook_sutra_updates']);
};
