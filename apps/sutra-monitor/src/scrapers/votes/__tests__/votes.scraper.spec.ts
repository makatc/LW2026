/**
 * Unit tests for VotesScraper
 *
 * Playwright is fully mocked. Tests cover: vote extraction, versioning,
 * graceful return when no votes found, and individual vote linking.
 */

import { VotesScraper } from '../votes.scraper';

// ─── Mock Playwright ──────────────────────────────────────────────────────────

jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn(),
    },
}));

import { chromium } from 'playwright';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface RawVoteEval {
    yea_count: number;
    nay_count: number;
    abstain_count: number;
    other_count: number;
    result?: string;
    vote_date?: string;
    motion_text: string;
    chamber: string;
    individual_votes: Array<{ legislator_name: string; option: string }>;
}

const VOTE_WITH_DATA: RawVoteEval = {
    yea_count: 18,
    nay_count: 9,
    abstain_count: 1,
    other_count: 0,
    result: 'pass',
    vote_date: '03/15/2025',
    motion_text: 'Votación - PS 1234',
    chamber: 'upper',
    individual_votes: [
        { legislator_name: 'Juan Pérez', option: 'yea' },
        { legislator_name: 'María González', option: 'nay' },
    ],
};

function makeMockBrowser(voteEval: RawVoteEval | null = VOTE_WITH_DATA) {
    const page = {
        goto: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockResolvedValue(voteEval),
        close: jest.fn().mockResolvedValue(undefined),
    };

    const browser = {
        newPage: jest.fn().mockResolvedValue(page),
        close: jest.fn().mockResolvedValue(undefined),
    };

    (chromium.launch as jest.Mock).mockResolvedValue(browser);
    return { browser, page };
}

// ─── DB mock ──────────────────────────────────────────────────────────────────

interface DbScenario {
    measures?: Array<{ id: string; numero: string; source_url: string }>;
    existingVoteHash?: string | null;
}

function makeDb({ measures = [], existingVoteHash = null }: DbScenario = {}) {
    return {
        query: jest.fn(async (sql: string, params?: any[]) => {
            // Measures query (to find which bills to check)
            if (sql.includes('SELECT id, numero, source_url FROM sutra_measures')) {
                return { rows: measures };
            }
            // Measure lookup by numero
            if (sql.includes('SELECT id FROM sutra_measures WHERE numero')) {
                const num = params?.[0];
                const match = measures.find(m => m.numero === num);
                return { rows: match ? [{ id: match.id }] : [] };
            }
            // Vote dedup check
            if (sql.includes('SELECT id FROM votes WHERE hash')) {
                return { rows: existingVoteHash ? [{ id: 'existing-vote' }] : [] };
            }
            // Vote insert
            if (sql.includes('INSERT INTO votes')) {
                return { rows: [{ id: 'new-vote-uuid' }] };
            }
            // Legislator lookup for individual votes
            if (sql.includes('SELECT id FROM legislators WHERE full_name ILIKE')) {
                const name = (params?.[0] ?? '').toLowerCase();
                if (name.includes('juan')) return { rows: [{ id: 'leg-001' }] };
                return { rows: [] };
            }
            // Individual vote insert
            if (sql.includes('INSERT INTO individual_votes')) {
                return { rows: [] };
            }
            return { rows: [] };
        }),
    };
}

function makeRecorder() {
    return {
        start: jest.fn().mockResolvedValue('run-votes-001'),
        complete: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VotesScraper — runPipeline', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns a valid PipelineResult', async () => {
        makeMockBrowser();
        const db = makeDb({ measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }] });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.scraperName).toBe('votes');
        expect(typeof result.recordsScraped).toBe('number');
        expect(typeof result.recordsNew).toBe('number');
        expect(typeof result.durationMs).toBe('number');
    });

    it('records run start and completion', async () => {
        makeMockBrowser();
        const db = makeDb({ measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }] });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        await scraper.runPipeline();

        expect(recorder.start).toHaveBeenCalledWith('votes');
        expect(recorder.complete).toHaveBeenCalledTimes(1);
        expect(recorder.fail).not.toHaveBeenCalled();
    });

    it('returns zero counts and does not throw when no measures in DB', async () => {
        makeMockBrowser();
        const db = makeDb({ measures: [] });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsScraped).toBe(0);
        expect(result.recordsNew).toBe(0);
        expect(chromium.launch).not.toHaveBeenCalled(); // Browser never opened
    });

    it('inserts new vote when not previously recorded', async () => {
        makeMockBrowser(VOTE_WITH_DATA);
        const db = makeDb({
            measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }],
            existingVoteHash: null,
        });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsNew).toBe(1);
        const voteInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('INSERT INTO votes'),
        );
        expect(voteInserts.length).toBe(1);
    });

    it('skips vote when hash already exists (deduplication)', async () => {
        makeMockBrowser(VOTE_WITH_DATA);
        const db = makeDb({
            measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }],
            existingVoteHash: 'some-existing-hash',
        });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsNew).toBe(0);
        const voteInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('INSERT INTO votes'),
        );
        expect(voteInserts.length).toBe(0);
    });

    it('inserts individual votes for known legislators', async () => {
        makeMockBrowser(VOTE_WITH_DATA);
        const db = makeDb({
            measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }],
        });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        await scraper.runPipeline();

        const ivInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('INSERT INTO individual_votes'),
        );
        // Both Juan (found) and María (not found but name still inserted)
        expect(ivInserts.length).toBe(VOTE_WITH_DATA.individual_votes.length);
    });

    it('does not throw when page has no vote data', async () => {
        makeMockBrowser(null); // evaluate returns null = no votes on this page
        const db = makeDb({
            measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }],
        });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsNew).toBe(0);
        expect(recorder.fail).not.toHaveBeenCalled();
    });

    it('does NOT rethrow pipeline errors (votes are optional)', async () => {
        // DB query for measures throws
        const db = {
            query: jest.fn().mockRejectedValue(new Error('DB connection lost')),
        };
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        // VotesScraper catches and returns error result instead of throwing
        expect(result.error).toBeDefined();
        expect(result.recordsScraped).toBe(0);
    });
});

describe('VotesScraper — date normalization', () => {
    beforeEach(() => jest.clearAllMocks());

    it('converts MM/DD/YYYY to YYYY-MM-DD for DB storage', async () => {
        const voteWithMMDDYYYY = { ...VOTE_WITH_DATA, vote_date: '03/15/2025' };
        makeMockBrowser(voteWithMMDDYYYY);
        const db = makeDb({
            measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }],
        });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        await scraper.runPipeline();

        const voteInsert = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('INSERT INTO votes'),
        );
        // voteDate param (index 1 in params array)
        const voteDate = voteInsert?.[1][1];
        expect(voteDate).toBe('2025-03-15');
    });

    it('passes ISO dates through unchanged', async () => {
        const voteWithISO = { ...VOTE_WITH_DATA, vote_date: '2025-03-15' };
        makeMockBrowser(voteWithISO);
        const db = makeDb({
            measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' }],
        });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        await scraper.runPipeline();

        const voteInsert = (db.query as jest.Mock).mock.calls.find(
            ([sql]: [string]) => sql.includes('INSERT INTO votes'),
        );
        const voteDate = voteInsert?.[1][1];
        expect(voteDate).toBe('2025-03-15');
    });
});

describe('VotesScraper — multiple measures', () => {
    beforeEach(() => jest.clearAllMocks());

    it('scrapes votes for each measure in order', async () => {
        const measures = [
            { id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' },
            { id: 'm2', numero: 'PC567', source_url: 'https://sutra.oslpr.org/medidas/PC567' },
        ];

        makeMockBrowser(VOTE_WITH_DATA);
        const db = makeDb({ measures });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        // One vote per measure → 2 new votes
        expect(result.recordsNew).toBe(2);
    });

    it('continues processing other measures when one page throws', async () => {
        const measures = [
            { id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/medidas/PS1234' },
            { id: 'm2', numero: 'PC567', source_url: 'https://sutra.oslpr.org/medidas/PC567' },
        ];

        let callCount = 0;
        const page = {
            goto: jest.fn(async () => {
                callCount++;
                if (callCount === 1) throw new Error('Page timeout');
            }),
            evaluate: jest.fn().mockResolvedValue(VOTE_WITH_DATA),
            close: jest.fn().mockResolvedValue(undefined),
        };
        const browser = {
            newPage: jest.fn().mockResolvedValue(page),
            close: jest.fn().mockResolvedValue(undefined),
        };
        (chromium.launch as jest.Mock).mockResolvedValue(browser);

        const db = makeDb({ measures });
        const recorder = makeRecorder();
        const scraper = new VotesScraper(db as any, recorder as any);

        // Should not throw
        const result = await scraper.runPipeline();

        expect(result).toBeDefined();
        expect(recorder.fail).not.toHaveBeenCalled();
    });
});
