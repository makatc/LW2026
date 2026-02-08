-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Sutra Commissions
CREATE TABLE IF NOT EXISTS sutra_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50), -- 'Comisiones Conjuntas', 'Cámara de Representantes', 'Senado'
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Sutra Measures
CREATE TABLE IF NOT EXISTS sutra_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(50) NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    extracto TEXT,
    comision_id UUID REFERENCES sutra_commissions(id) ON DELETE SET NULL,
    author TEXT,
    fecha TIMESTAMP,
    source_url TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL,
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sutra_measures_comision_id_idx ON sutra_measures(comision_id);
CREATE INDEX IF NOT EXISTS sutra_measures_fecha_idx ON sutra_measures(fecha);
CREATE INDEX IF NOT EXISTS sutra_measures_hash_idx ON sutra_measures(hash);

-- 3. Ingest Runs
CREATE TABLE IF NOT EXISTS ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    status VARCHAR(20) NOT NULL, -- RUNNING, SUCCESS, FAILED, NEEDS_MANUAL
    measures_found INTEGER DEFAULT 0,
    measures_new INTEGER DEFAULT 0,
    measures_updated INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Sutra Measure Snapshots
CREATE TABLE IF NOT EXISTS sutra_measure_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id UUID NOT NULL REFERENCES sutra_measures(id) ON DELETE CASCADE,
    captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
    source_url TEXT NOT NULL,
    raw_html_path TEXT,
    hash VARCHAR(64) NOT NULL,
    change_type VARCHAR(20), -- CREATED, UPDATED, NO_CHANGE
    ingest_run_id UUID REFERENCES ingest_runs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS sutra_measure_snapshots_measure_id_captured_at_idx ON sutra_measure_snapshots(measure_id, captured_at);

-- 5. Config Tables
CREATE TABLE IF NOT EXISTS monitor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    webhook_alerts TEXT,
    webhook_sutra_updates TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keyword_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES monitor_configs(id) ON DELETE CASCADE,
    keyword VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS keyword_rules_config_id_idx ON keyword_rules(config_id);

CREATE TABLE IF NOT EXISTS phrase_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES monitor_configs(id) ON DELETE CASCADE,
    phrase TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES monitor_configs(id) ON DELETE CASCADE,
    commission_id UUID NOT NULL REFERENCES sutra_commissions(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_config_commission UNIQUE (config_id, commission_id)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES monitor_configs(id) ON DELETE CASCADE,
    measure_id UUID REFERENCES sutra_measures(id) ON DELETE CASCADE,
    measure_number VARCHAR(50),
    enabled BOOLEAN DEFAULT TRUE,
    added_from VARCHAR(20) NOT NULL, -- MANUAL, DASHBOARD
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_config_measure UNIQUE (config_id, measure_id)
);

-- 6. Discovery & Tracking
CREATE TABLE IF NOT EXISTS discovery_hits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES monitor_configs(id) ON DELETE CASCADE,
    measure_id UUID NOT NULL REFERENCES sutra_measures(id) ON DELETE CASCADE,
    hit_type VARCHAR(20) NOT NULL, -- KEYWORD, TOPIC, COMMISSION
    rule_id UUID,
    score DECIMAL(5,2),
    evidence TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_hit UNIQUE (config_id, measure_id, hit_type, rule_id)
);
CREATE INDEX IF NOT EXISTS discovery_hits_config_id_created_at_idx ON discovery_hits(config_id, created_at);

CREATE TABLE IF NOT EXISTS measure_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id UUID NOT NULL REFERENCES sutra_measures(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    event_date DATE,
    url TEXT,
    hash VARCHAR(64) NOT NULL,
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_event_hash UNIQUE (measure_id, hash)
);

CREATE TABLE IF NOT EXISTS measure_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id UUID NOT NULL REFERENCES sutra_measures(id) ON DELETE CASCADE,
    update_type VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS measure_updates_measure_id_captured_at_idx ON measure_updates(measure_id, captured_at);

-- 7. System Settings (Cursor Logic)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
