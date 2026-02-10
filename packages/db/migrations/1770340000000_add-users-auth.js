exports.up = (pgm) => {
    // Users table
    pgm.createTable('users', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        email: {
            type: 'varchar(255)',
            notNull: true,
            unique: true
        },
        password_hash: {
            type: 'text',
            notNull: true
        },
        name: {
            type: 'varchar(255)',
            notNull: true
        },
        role: {
            type: 'varchar(50)',
            notNull: true,
            default: 'user'
        },
        is_active: {
            type: 'boolean',
            notNull: true,
            default: true
        },
        created_at: {
            type: 'timestamptz',
            notNull: true,
            default: pgm.func('NOW()')
        },
        updated_at: {
            type: 'timestamptz',
            notNull: true,
            default: pgm.func('NOW()')
        },
        last_login_at: {
            type: 'timestamptz'
        }
    });

    // Create index on email for faster lookups
    pgm.createIndex('users', 'email');

    // Update monitor_configs to reference users
    pgm.addColumn('monitor_configs', {
        user_id: {
            type: 'uuid',
            references: 'users(id)',
            onDelete: 'CASCADE'
        }
    });

    // Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
    // Hash generated with bcrypt for 'admin123'
    pgm.sql(`
        INSERT INTO users (email, password_hash, name, role)
        VALUES (
            'admin@sutramonitor.com',
            '$2b$10$Ch7dXpUc6BqqUXuNRAn0JeEnR93N0XJiNhlFpfITWRFcecKdVyw6a',
            'Admin User',
            'admin'
        )
    `);
};

exports.down = (pgm) => {
    pgm.dropColumn('monitor_configs', 'user_id');
    pgm.dropTable('users');
};
