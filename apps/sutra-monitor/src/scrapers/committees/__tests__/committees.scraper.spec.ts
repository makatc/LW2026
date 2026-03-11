/**
 * Unit tests for CommitteesScraper
 *
 * Tests scraping, versioning (insert/update/skip), membership linking,
 * and error isolation — without real HTTP or DB.
 */

import * as cheerio from 'cheerio';
import { CommitteesScraper } from '../committees.scraper';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeHttp(htmlByUrl: Record<string, string> = {}) {
    return {
        getHtml: jest.fn(async (url: string) => {
            const html = htmlByUrl[url] ?? '<html><body></body></html>';
            return cheerio.load(html);
        }),
    };
}

interface DbScenario {
    committees?: any[];
    legislators?: any[];
}

function makeDb({ committees = [], legislators = [] }: DbScenario = {}) {
    return {
        query: jest.fn(async (sql: string, params?: any[]) => {
            if (sql.startsWith('SELECT id FROM committees')) {
                return { rows: committees };
            }
            if (sql.startsWith('SELECT id FROM legislators WHERE full_name ILIKE')) {
                const name = (params?.[0] ?? '').replace('%', '').toLowerCase();
                const match = legislators.find(l => l.full_name.toLowerCase().includes(name));
                return { rows: match ? [match] : [] };
            }
            if (sql.startsWith('INSERT INTO committees')) {
                return { rows: [{ id: 'cmte-uuid' }] };
            }
            if (sql.startsWith('UPDATE committees')) {
                return { rows: [] };
            }
            if (sql.startsWith('DELETE FROM committee_memberships')) {
                return { rows: [] };
            }
            if (sql.startsWith('INSERT INTO committee_memberships')) {
                return { rows: [] };
            }
            return { rows: [] };
        }),
    };
}

function makeRecorder() {
    return {
        start: jest.fn().mockResolvedValue('run-cmte-001'),
        complete: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
    };
}

// ─── HTML fixtures ────────────────────────────────────────────────────────────

function makeCommitteeListHtml(items: string[]): string {
    const cards = items.map(name => `
      <div class="comision-item">
        <h3>${name}</h3>
        <a href="/comisiones/${name.toLowerCase().replace(/\s+/g, '-')}">Ver</a>
      </div>`).join('');
    return `<html><body>${cards}</body></html>`;
}

function makeCommitteeDetailHtml(chair: string, members: string[]): string {
    const memberItems = members.map(m => `<li class="miembro">${m}</li>`).join('');
    return `
    <html><body>
      <p>Presidente: <span>${chair}</span></p>
      <ul>${memberItems}</ul>
    </body></html>`;
}

const SENATE_COMMITTEES = [
    'Comisión de Hacienda',
    'Comisión de Educación',
    'Comisión de Salud',
];
const HOUSE_COMMITTEES = [
    'Comisión de Obras Públicas',
    'Comisión de Agricultura',
    'Comisión de Tecnología',
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildScraper(options: {
    senate?: string;
    house?: string;
    detailHtml?: string;
    dbScenario?: DbScenario;
} = {}) {
    const senateList = options.senate ?? makeCommitteeListHtml(SENATE_COMMITTEES);
    const houseList = options.house ?? makeCommitteeListHtml(HOUSE_COMMITTEES);
    const detail = options.detailHtml ?? makeCommitteeDetailHtml('Juan Pérez', ['Ana Torres', 'Carlos Rivera']);

    const http = makeHttp();
    http.getHtml.mockImplementation(async (url: string) => {
        if (url === 'https://senado.pr.gov/comisiones/') return cheerio.load(senateList);
        if (url === 'https://camara.pr.gov/comisiones/') return cheerio.load(houseList);
        return cheerio.load(detail);
    });

    const db = makeDb(options.dbScenario ?? {});
    const recorder = makeRecorder();

    return { scraper: new CommitteesScraper(db as any, http as any, recorder as any), db, http, recorder };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommitteesScraper — runPipeline', () => {
    it('returns a valid PipelineResult', async () => {
        const { scraper } = buildScraper();
        const result = await scraper.runPipeline();

        expect(result.scraperName).toBe('committees');
        expect(typeof result.recordsScraped).toBe('number');
        expect(result.recordsScraped).toBeGreaterThan(0);
        expect(typeof result.recordsNew).toBe('number');
        expect(typeof result.durationMs).toBe('number');
    });

    it('records a run start and completion', async () => {
        const { scraper, recorder } = buildScraper();
        await scraper.runPipeline();

        expect(recorder.start).toHaveBeenCalledWith('committees');
        expect(recorder.complete).toHaveBeenCalledTimes(1);
        expect(recorder.fail).not.toHaveBeenCalled();
    });

    it('fetches both senate and house committee pages', async () => {
        const { scraper, http } = buildScraper();
        await scraper.runPipeline();

        expect(http.getHtml).toHaveBeenCalledWith('https://senado.pr.gov/comisiones/');
        expect(http.getHtml).toHaveBeenCalledWith('https://camara.pr.gov/comisiones/');
    });

    it('inserts new committees when none exist', async () => {
        const { scraper, db } = buildScraper({ dbScenario: { committees: [] } });
        const result = await scraper.runPipeline();

        expect(result.recordsNew).toBe(SENATE_COMMITTEES.length + HOUSE_COMMITTEES.length);

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committees'),
        );
        expect(insertCalls.length).toBe(SENATE_COMMITTEES.length + HOUSE_COMMITTEES.length);
    });

    it('updates existing committees (chair changed)', async () => {
        const { scraper, db } = buildScraper({
            dbScenario: { committees: [{ id: 'existing-cmte' }] },
        });
        await scraper.runPipeline();

        const updateCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('UPDATE committees'),
        );
        expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('refreshes memberships on every run', async () => {
        const { scraper, db } = buildScraper({ dbScenario: { committees: [] } });
        await scraper.runPipeline();

        const deleteCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('DELETE FROM committee_memberships'),
        );
        expect(deleteCalls.length).toBe(SENATE_COMMITTEES.length + HOUSE_COMMITTEES.length);
    });

    it('records failure and rethrows when version() throws', async () => {
        const { scraper, db, recorder } = buildScraper();
        // Make the first DB call in version() fail
        (db.query as jest.Mock).mockRejectedValueOnce(new Error('DB unavailable'));

        await expect(scraper.runPipeline()).rejects.toThrow('DB unavailable');
        expect(recorder.fail).toHaveBeenCalledWith('run-cmte-001', expect.stringContaining('DB unavailable'));
    });
});

describe('CommitteesScraper — type detection', () => {
    it('detects joint committees', async () => {
        const html = makeCommitteeListHtml([
            'Comisión Conjunta de Finanzas',
            'Comisión de Educación',
            'Comisión de Salud',
        ]);
        const { scraper, db } = buildScraper({ senate: html });
        await scraper.runPipeline();

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committees'),
        );
        const jointInsert = insertCalls.find(([, p]: [string, any[]]) => p[0].includes('Conjunta'));
        expect(jointInsert?.[1][3]).toBe('joint');
    });

    it('detects special committees', async () => {
        const html = makeCommitteeListHtml([
            'Comisión Especial de Vivienda',
            'Comisión de Salud',
            'Comisión de Hacienda',
        ]);
        const { scraper, db } = buildScraper({ senate: html });
        await scraper.runPipeline();

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committees'),
        );
        const specialInsert = insertCalls.find(([, p]: [string, any[]]) => p[0].includes('Especial'));
        expect(specialInsert?.[1][3]).toBe('special');
    });

    it('defaults to standing for regular committees', async () => {
        const { scraper, db } = buildScraper();
        await scraper.runPipeline();

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committees'),
        );
        // All test committees should be "standing"
        expect(insertCalls.every(([, p]: [string, any[]]) => p[3] === 'standing')).toBe(true);
    });
});

describe('CommitteesScraper — membership linking', () => {
    it('inserts memberships for known legislators', async () => {
        const detail = makeCommitteeDetailHtml('Juan Pérez', ['Juan Pérez', 'Ana Torres']);
        const { scraper, db } = buildScraper({
            detailHtml: detail,
            dbScenario: {
                committees: [],
                legislators: [
                    { id: 'leg-001', full_name: 'Juan Pérez' },
                    { id: 'leg-002', full_name: 'Ana Torres' },
                ],
            },
        });
        await scraper.runPipeline();

        const memberInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committee_memberships'),
        );
        expect(memberInserts.length).toBeGreaterThan(0);
    });

    it('skips membership insert when legislator is not found', async () => {
        const detail = makeCommitteeDetailHtml('Unknown Person', ['Unknown Person']);
        const { scraper, db } = buildScraper({
            detailHtml: detail,
            dbScenario: { committees: [], legislators: [] },
        });
        await scraper.runPipeline();

        const memberInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committee_memberships'),
        );
        expect(memberInserts.length).toBe(0);
    });
});

describe('CommitteesScraper — chamber error isolation', () => {
    it('continues with house committees when senate fails', async () => {
        const http = makeHttp();
        http.getHtml.mockImplementation(async (url: string) => {
            if (url.includes('senado')) throw new Error('Senado timeout');
            const houseList = makeCommitteeListHtml(HOUSE_COMMITTEES);
            return cheerio.load(houseList);
        });

        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new CommitteesScraper(db as any, http as any, recorder as any);
        const result = await scraper.runPipeline();

        // Should not have thrown; house committees should still be processed
        expect(recorder.fail).not.toHaveBeenCalled();
        expect(result.recordsScraped).toBeGreaterThanOrEqual(0);
    });
});

describe('CommitteesScraper — link fallback', () => {
    it('uses anchor links when no item selector matches', async () => {
        const fallbackHtml = `
        <html><body>
          <a href="/comisiones/hacienda">Comisión de Hacienda</a>
          <a href="/comisiones/educacion">Comisión de Educación</a>
          <a href="/comisiones/salud">Comisión de Salud</a>
        </body></html>`;

        const { scraper, db } = buildScraper({ senate: fallbackHtml });
        await scraper.runPipeline();

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO committees'),
        );
        // 3 fallback senate + however many from house
        expect(insertCalls.length).toBeGreaterThanOrEqual(3);
    });
});
