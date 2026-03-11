export type ChangeEntityType = 'bill' | 'legislator' | 'committee' | 'vote' | 'bill_version';
export type ChangeEventType = 'created' | 'updated';

export interface ChangeEventPayload {
    entityType: ChangeEntityType;
    eventType: ChangeEventType;
    entityId?: string | null;
    scraperName: string;
    summary: string;             // Human-readable: "PS1234 updated: status changed"
    after: Record<string, any>;  // New/current state (key fields only)
}

export interface ChangeEventRow {
    id: string;
    entity_type: ChangeEntityType;
    entity_id: string | null;
    event_type: ChangeEventType;
    scraper_name: string;
    summary: string;
    payload: Record<string, any>;
    created_at: string;
}
