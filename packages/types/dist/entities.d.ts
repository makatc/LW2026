export interface SutraCommission {
    id: string;
    name: string;
    slug: string;
    created_at: Date;
}
export interface SutraMeasure {
    id: string;
    numero: string;
    titulo: string;
    extracto: string;
    comision_id?: string;
    author?: string | null;
    fecha: Date;
    source_url: string;
    hash: string;
    first_seen_at: Date;
    last_seen_at: Date;
    created_at: Date;
    updated_at: Date;
}
export interface SutraMeasureSnapshot {
    id: string;
    measure_id: string;
    captured_at: Date;
    source_url: string;
    raw_html_path?: string;
    hash: string;
    change_type: 'CREATED' | 'UPDATED' | 'NO_CHANGE';
    ingest_run_id?: string;
}
export interface IngestRun {
    id: string;
    started_at: Date;
    ended_at?: Date;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'NEEDS_MANUAL';
    measures_found: number;
    measures_new: number;
    measures_updated: number;
    error_message?: string;
    created_at: Date;
}
export interface MonitorConfig {
    id: string;
    user_id?: string;
    webhook_alerts?: string;
    webhook_sutra_updates?: string;
    created_at: Date;
    updated_at: Date;
}
export interface KeywordRule {
    id: string;
    config_id: string;
    keyword: string;
    enabled: boolean;
    created_at: Date;
}
export interface PhraseRule {
    id: string;
    config_id: string;
    phrase: string;
    enabled: boolean;
    created_at: Date;
}
export interface CommissionFollow {
    id: string;
    config_id: string;
    commission_id: string;
    enabled: boolean;
    created_at: Date;
}
export interface WatchlistItem {
    id: string;
    config_id: string;
    measure_id?: string;
    measure_number?: string;
    enabled: boolean;
    added_from: 'MANUAL' | 'DASHBOARD';
    created_at: Date;
}
export interface DiscoveryHit {
    id: string;
    config_id: string;
    measure_id: string;
    hit_type: 'KEYWORD' | 'TOPIC' | 'COMMISSION';
    rule_id?: string;
    score?: number;
    evidence?: string;
    created_at: Date;
}
export interface MeasureEvent {
    id: string;
    measure_id: string;
    event_type: string;
    title: string;
    event_date?: Date;
    url?: string;
    hash: string;
    first_seen_at: Date;
    created_at: Date;
}
export interface MeasureUpdate {
    id: string;
    measure_id: string;
    update_type: string;
    summary: string;
    captured_at: Date;
    hash: string;
    created_at: Date;
}
