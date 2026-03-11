/**
 * Unit tests for ChangeEventService
 *
 * Tests: record() persists to DB and emits Node events,
 * getRecent() with filters, getStats(), and non-critical failure isolation.
 */

import { ChangeEventService } from '../change-event.service';
import { ChangeEventPayload } from '../change-event.types';

// ─── DB mock ──────────────────────────────────────────────────────────────────

function makeDb(insertRow = { id: 'evt-uuid', created_at: new Date().toISOString() }) {
    return {
        query: jest.fn(async (sql: string) => {
            // Table bootstrap (CREATE TABLE / CREATE INDEX)
            if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
                return { rows: [] };
            }
            // INSERT INTO change_events
            if (sql.includes('INSERT INTO change_events')) {
                return { rows: [insertRow] };
            }
            // SELECT (getRecent / getStats)
            return { rows: [] };
        }),
    };
}

async function buildService(db = makeDb()) {
    const service = new ChangeEventService(db as any);
    await service.onModuleInit(); // bootstrap table
    return { service, db };
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

const BILL_CREATED: ChangeEventPayload = {
    entityType: 'bill',
    eventType: 'created',
    entityId: 'bill-uuid-001',
    scraperName: 'bills',
    summary: 'New bill: PS1234 — Para enmendar la Ley',
    after: { numero: 'PS1234', bill_type: 'bill', status: 'En trámite' },
};

const LEGISLATOR_UPDATED: ChangeEventPayload = {
    entityType: 'legislator',
    eventType: 'updated',
    entityId: 'leg-uuid-001',
    scraperName: 'legislators',
    summary: 'Updated legislator: Juan Pérez (upper)',
    after: { full_name: 'Juan Pérez', chamber: 'upper', party: 'PNP' },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChangeEventService — record()', () => {
    it('inserts the event into the DB', async () => {
        const { service, db } = await buildService();
        await service.record(BILL_CREATED);

        const insertCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('INSERT INTO change_events'),
        );
        expect(insertCall).toBeDefined();
        const params = insertCall[1];
        expect(params[0]).toBe('bill');         // entity_type
        expect(params[1]).toBe('bill-uuid-001'); // entity_id
        expect(params[2]).toBe('created');       // event_type
        expect(params[3]).toBe('bills');         // scraper_name
        expect(params[4]).toContain('PS1234');   // summary
    });

    it('serializes the after payload as JSON string', async () => {
        const { service, db } = await buildService();
        await service.record(BILL_CREATED);

        const insertCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('INSERT INTO change_events'),
        );
        const jsonParam = insertCall[1][5];
        expect(typeof jsonParam).toBe('string');
        const parsed = JSON.parse(jsonParam);
        expect(parsed.numero).toBe('PS1234');
    });

    it('emits a specific event (entity_type.event_type)', async () => {
        const { service } = await buildService();
        const handler = jest.fn();
        service.on('bill.created', handler);

        await service.record(BILL_CREATED);

        expect(handler).toHaveBeenCalledTimes(1);
        const emitted = handler.mock.calls[0][0];
        expect(emitted.entity_type).toBe('bill');
        expect(emitted.event_type).toBe('created');
        expect(emitted.summary).toContain('PS1234');
    });

    it('emits wildcard "*" event for any record', async () => {
        const { service } = await buildService();
        const wildcard = jest.fn();
        service.on('*', wildcard);

        await service.record(BILL_CREATED);
        await service.record(LEGISLATOR_UPDATED);

        expect(wildcard).toHaveBeenCalledTimes(2);
    });

    it('emits correct event name for legislator.updated', async () => {
        const { service } = await buildService();
        const legHandler = jest.fn();
        const billHandler = jest.fn();
        service.on('legislator.updated', legHandler);
        service.on('bill.created', billHandler);

        await service.record(LEGISLATOR_UPDATED);

        expect(legHandler).toHaveBeenCalledTimes(1);
        expect(billHandler).not.toHaveBeenCalled();
    });

    it('does NOT throw when DB insert fails (non-critical)', async () => {
        const db = makeDb();
        (db.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('INSERT INTO change_events')) throw new Error('DB down');
            return { rows: [] };
        });
        const { service } = await buildService(db);

        // Should resolve, not reject
        await expect(service.record(BILL_CREATED)).resolves.toBeUndefined();
    });

    it('handles null entityId', async () => {
        const { service, db } = await buildService();
        await service.record({ ...BILL_CREATED, entityId: null });

        const insertCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('INSERT INTO change_events'),
        );
        expect(insertCall[1][1]).toBeNull();
    });
});

describe('ChangeEventService — getRecent()', () => {
    it('queries without filters by default', async () => {
        const db = makeDb();
        (db.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('CREATE')) return { rows: [] };
            if (sql.includes('SELECT')) {
                return {
                    rows: [
                        { id: 'e1', entity_type: 'bill', event_type: 'created', summary: 'Bill created', created_at: new Date() },
                        { id: 'e2', entity_type: 'legislator', event_type: 'updated', summary: 'Leg updated', created_at: new Date() },
                    ],
                };
            }
            return { rows: [] };
        });
        const { service } = await buildService(db);

        const rows = await service.getRecent();

        expect(rows.length).toBe(2);
    });

    it('adds entity_type filter when provided', async () => {
        const { service, db } = await buildService();
        await service.getRecent({ entityType: 'bill' });

        const selectCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('SELECT') && sql.includes('entity_type'),
        );
        expect(selectCall).toBeDefined();
        expect(selectCall[1]).toContain('bill');
    });

    it('adds since filter when provided', async () => {
        const { service, db } = await buildService();
        const since = new Date('2026-03-01T00:00:00Z');
        await service.getRecent({ since });

        const selectCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('created_at >'),
        );
        expect(selectCall).toBeDefined();
        expect(selectCall[1]).toContain(since.toISOString());
    });

    it('respects custom limit', async () => {
        const { service, db } = await buildService();
        await service.getRecent({ limit: 10 });

        const selectCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('LIMIT'),
        );
        expect(selectCall?.[1]).toContain(10);
    });
});

describe('ChangeEventService — getStats()', () => {
    it('returns aggregated counts by entity.event', async () => {
        const db = makeDb();
        (db.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('CREATE')) return { rows: [] };
            if (sql.includes('GROUP BY')) {
                return {
                    rows: [
                        { entity_type: 'bill', event_type: 'created', count: 42 },
                        { entity_type: 'legislator', event_type: 'updated', count: 7 },
                    ],
                };
            }
            return { rows: [] };
        });
        const { service } = await buildService(db);

        const stats = await service.getStats();

        expect(stats['bill.created']).toBe(42);
        expect(stats['legislator.updated']).toBe(7);
    });
});

describe('ChangeEventService — onModuleInit (table bootstrap)', () => {
    it('creates change_events table and indexes on init', async () => {
        const { db } = await buildService();

        const createCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX'),
        );
        expect(createCalls.length).toBe(3); // 1 table + 2 indexes
    });

    it('does not throw when table already exists', async () => {
        const db = makeDb();
        // IF NOT EXISTS means this should never fail, but simulate it anyway
        (db.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
                return { rows: [] }; // Already exists — no error
            }
            return { rows: [] };
        });

        // Should not throw
        await expect(buildService(db)).resolves.toBeDefined();
    });
});
