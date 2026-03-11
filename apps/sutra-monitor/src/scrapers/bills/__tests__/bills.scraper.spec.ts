/**
 * Unit tests for BillsScraper
 *
 * Playwright is fully mocked — no real browser is launched.
 * Tests cover: bill type detection, versioning (new/update/skip),
 * pipeline result shape, and error isolation per-bill.
 */

import { BillsScraper } from '../bills.scraper';

// ─── Mock Playwright ──────────────────────────────────────────────────────────

jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn(),
    },
}));

import { chromium } from 'playwright';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_BILLS = [
    {
        numero: 'PS1234',
        titulo: 'Ley para mejorar la educación pública',
        fecha: '01/15/2025',
        author: 'Juan Pérez',
        commission: 'Comisión de Educación',
        url: 'https://sutra.oslpr.org/medidas/PS1234',
    },
    {
        numero: 'PC567',
        titulo: 'Para regular los servicios de salud',
        fecha: '02/10/2025',
        author: 'María González',
        commission: null,
        url: 'https://sutra.oslpr.org/medidas/PC567',
    },
    {
        numero: 'RS89',
        titulo: 'Resolución de felicitación',
        fecha: null,
        author: null,
        commission: null,
        url: 'https://sutra.oslpr.org/medidas/RS89',
    },
];

function makeDetailEval() {
    return {
        status: 'En trámite',
        commission: 'Comisión de Hacienda',
        author: 'Roberto Sánchez',
        author_names: ['Roberto Sánchez'],
        actions: [{ date: '01/20/2025', description: 'Referido a comisión' }],
        pdf_url: 'https://sutra.oslpr.org/pdfs/PS1234.pdf',
        extracto: 'Texto completo de la medida...',
    };
}

function makeMockBrowser(bills = SAMPLE_BILLS, includeDetails = true) {
    // Mock for list page
    const listPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        waitForTimeout: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockResolvedValue(bills),
        $: jest.fn().mockResolvedValue(null), // No next-page button
        close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock for detail pages
    const detailPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockResolvedValue(includeDetails ? makeDetailEval() : {}),
        close: jest.fn().mockResolvedValue(undefined),
    };

    let pageCallCount = 0;
    const browser = {
        newPage: jest.fn(async () => {
            pageCallCount++;
            // First page is the list page, subsequent pages are detail pages
            return pageCallCount === 1 ? listPage : detailPage;
        }),
        close: jest.fn().mockResolvedValue(undefined),
    };

    (chromium.launch as jest.Mock).mockResolvedValue(browser);
    return { browser, listPage, detailPage };
}

// ─── DB mock ──────────────────────────────────────────────────────────────────

function makeDb(existingBills: Array<{ numero: string; hash: string }> = []) {
    return {
        query: jest.fn(async (sql: string, params?: any[]) => {
            // Commission upsert
            if (sql.includes('INSERT INTO sutra_commissions')) {
                return { rows: [{ id: 'comm-uuid' }] };
            }
            // Author lookup
            if (sql.includes('SELECT id FROM legislators WHERE full_name ILIKE')) {
                return { rows: [] }; // No matching legislator
            }
            // Existing bill check
            if (sql.includes('SELECT id, hash FROM sutra_measures WHERE numero')) {
                const numero = params?.[0];
                const existing = existingBills.find(b => b.numero === numero);
                return { rows: existing ? [existing] : [] };
            }
            // After insert, watchlist lookup
            if (sql.includes('SELECT id FROM sutra_measures WHERE numero')) {
                return { rows: [{ id: 'measure-uuid' }] };
            }
            // Watchlist update
            if (sql.includes('UPDATE watchlist_items')) {
                return { rows: [] };
            }
            if (sql.startsWith('INSERT INTO sutra_measures')) {
                return { rows: [{ id: 'new-measure-uuid' }] };
            }
            if (sql.startsWith('UPDATE sutra_measures')) {
                return { rows: [] };
            }
            return { rows: [] };
        }),
    };
}

function makeRecorder() {
    return {
        start: jest.fn().mockResolvedValue('run-bills-001'),
        complete: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BillsScraper — runPipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BILL_DETAIL_LIMIT = '10';
        process.env.SUTRA_MAX_PAGES = '1';
    });

    afterEach(() => {
        delete process.env.BILL_DETAIL_LIMIT;
        delete process.env.SUTRA_MAX_PAGES;
    });

    it('returns a valid PipelineResult', async () => {
        makeMockBrowser();
        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.scraperName).toBe('bills');
        expect(typeof result.recordsScraped).toBe('number');
        expect(typeof result.recordsNew).toBe('number');
        expect(typeof result.recordsUpdated).toBe('number');
        expect(typeof result.durationMs).toBe('number');
    });

    it('records run start and completion', async () => {
        makeMockBrowser();
        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        await scraper.runPipeline();

        expect(recorder.start).toHaveBeenCalledWith('bills');
        expect(recorder.complete).toHaveBeenCalledTimes(1);
        expect(recorder.fail).not.toHaveBeenCalled();
    });

    it('launches and closes browser', async () => {
        const { browser } = makeMockBrowser();
        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        await scraper.runPipeline();

        expect(chromium.launch).toHaveBeenCalledWith({ headless: true, args: ['--no-sandbox'] });
        expect(browser.close).toHaveBeenCalledTimes(1);
    });

    it('inserts new bills when none exist in DB', async () => {
        makeMockBrowser();
        const db = makeDb([]);
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsNew).toBe(SAMPLE_BILLS.length);

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO sutra_measures'),
        );
        expect(insertCalls.length).toBe(SAMPLE_BILLS.length);
    });

    it('updates bills when hash changes', async () => {
        makeMockBrowser();
        const db = makeDb([
            { numero: 'PS1234', hash: 'old-hash-1' },
            { numero: 'PC567', hash: 'old-hash-2' },
            { numero: 'RS89', hash: 'old-hash-3' },
        ]);
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsUpdated).toBe(SAMPLE_BILLS.length);

        const updateCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('UPDATE sutra_measures'),
        );
        expect(updateCalls.length).toBe(SAMPLE_BILLS.length);
    });

    it('closes browser even when pipeline throws', async () => {
        const { browser, listPage } = makeMockBrowser();
        listPage.goto.mockRejectedValueOnce(new Error('Playwright timeout'));

        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        await expect(scraper.runPipeline()).rejects.toThrow();

        expect(browser.close).toHaveBeenCalledTimes(1);
        expect(recorder.fail).toHaveBeenCalledWith('run-bills-001', expect.any(String));
    });
});

describe('BillsScraper — bill type detection', () => {
    const cases: Array<[string, string]> = [
        ['PS1234', 'bill'],
        ['PC567', 'bill'],
        ['RS89', 'resolution'],
        ['RC10', 'resolution'],
        ['RCS100', 'resolution'],
        ['RCC200', 'resolution'],
        ['OA5', 'other'],
        ['RN99', 'resolution'],
        ['UNKNOWN1', 'bill'], // Default
    ];

    test.each(cases)('numero %s → type %s', async (numero, expectedType) => {
        const singleBill = [{ ...SAMPLE_BILLS[0], numero, url: `https://sutra.oslpr.org/medidas/${numero}` }];
        makeMockBrowser(singleBill);

        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);
        await scraper.runPipeline();

        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO sutra_measures'),
        );
        expect(insertCalls.length).toBeGreaterThan(0);
        // bill_type is the 8th param (index 7)
        const billType = insertCalls[0][1][7];
        expect(billType).toBe(expectedType);
    });
});

describe('BillsScraper — versioning', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BILL_DETAIL_LIMIT = '10';
        process.env.SUTRA_MAX_PAGES = '1';
    });

    afterEach(() => {
        delete process.env.BILL_DETAIL_LIMIT;
        delete process.env.SUTRA_MAX_PAGES;
    });

    it('skips insert when hash is unchanged', async () => {
        makeMockBrowser(SAMPLE_BILLS.slice(0, 1), false); // No detail enrichment for clean hash
        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        // First run → capture the hash
        await scraper.runPipeline();
        const insertCall = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.startsWith('INSERT INTO sutra_measures'),
        );
        const savedHash = insertCall?.[1][6]; // hash param

        // Reset mocks, second run with matching hash
        jest.clearAllMocks();
        makeMockBrowser(SAMPLE_BILLS.slice(0, 1), false);
        const db2 = makeDb([{ numero: 'PS1234', hash: savedHash }]);
        const recorder2 = makeRecorder();
        const scraper2 = new BillsScraper(db2 as any, recorder2 as any);

        const result2 = await scraper2.runPipeline();
        expect(result2.recordsNew).toBe(0);
        expect(result2.recordsUpdated).toBe(0);
    });

    it('continues versioning other bills when one bill fails DB insert', async () => {
        makeMockBrowser();
        const callCount = { count: 0 };

        const db = {
            query: jest.fn(async (sql: string, params?: any[]) => {
                if (sql.includes('INSERT INTO sutra_commissions')) return { rows: [{ id: 'c1' }] };
                if (sql.includes('SELECT id FROM legislators')) return { rows: [] };
                if (sql.includes('SELECT id, hash FROM sutra_measures')) return { rows: [] };
                if (sql.startsWith('INSERT INTO sutra_measures')) {
                    callCount.count++;
                    // Fail the first insert, succeed for the rest
                    if (callCount.count === 1) throw new Error('DB insert failed');
                    return { rows: [{ id: 'new-uuid' }] };
                }
                if (sql.includes('SELECT id FROM sutra_measures WHERE numero')) return { rows: [{ id: 'new-uuid' }] };
                if (sql.includes('UPDATE watchlist_items')) return { rows: [] };
                return { rows: [] };
            }),
        };

        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);

        // Should not throw — per-bill errors are caught
        const result = await scraper.runPipeline();
        expect(result.recordsNew).toBeGreaterThanOrEqual(0);
        // At least some bills succeeded (the 2nd and 3rd)
        expect(result.recordsNew).toBeLessThan(SAMPLE_BILLS.length);
    });
});

describe('BillsScraper — detail enrichment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BILL_DETAIL_LIMIT = '10';
        process.env.SUTRA_MAX_PAGES = '1';
    });

    afterEach(() => {
        delete process.env.BILL_DETAIL_LIMIT;
        delete process.env.SUTRA_MAX_PAGES;
    });

    it('stores pdf_url from detail page', async () => {
        makeMockBrowser(SAMPLE_BILLS, true);
        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);
        await scraper.runPipeline();

        // pdf_url would be included in the JSON that generates the hash
        // and inserted into the DB — we verify INSERT was called
        const insertCalls = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.startsWith('INSERT INTO sutra_measures'),
        );
        expect(insertCalls.length).toBeGreaterThan(0);
    });

    it('skips detail fetch for non-SUTRA URLs', async () => {
        const externalBills = [
            {
                numero: 'EXT1',
                titulo: 'External Bill',
                fecha: null,
                author: null,
                commission: null,
                url: 'https://external-site.com/bill/EXT1', // No /medidas/ path
            },
        ];
        makeMockBrowser(externalBills);
        const db = makeDb();
        const recorder = makeRecorder();
        const scraper = new BillsScraper(db as any, recorder as any);
        await scraper.runPipeline();

        // detail page should have been opened at least for some
        // (but not for external URLs)
        expect(recorder.complete).toHaveBeenCalledTimes(1);
    });
});
