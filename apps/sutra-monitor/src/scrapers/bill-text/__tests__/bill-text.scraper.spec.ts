/**
 * Unit tests for BillTextScraper
 *
 * axios and pdf-parse are mocked. Tests cover: PDF download, text extraction,
 * Gemini OCR fallback, hash-based versioning (new/updated/unchanged),
 * and pipeline result shape.
 */

// ─── Mock axios ───────────────────────────────────────────────────────────────

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ─── Mock pdf-parse (CommonJS require) ───────────────────────────────────────

const mockPdfParse = jest.fn();
jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn().mockImplementation(() => ({
        pdf: mockPdfParse,
    })),
}));

import { BillTextScraper } from '../bill-text.scraper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_PDF_BUFFER = Buffer.from('%PDF-1.4 sample content');
const EXTRACTED_TEXT = 'PROYECTO DEL SENADO 1234\nPara enmendar el Artículo 1 de la Ley 123-2020...';
const GEMINI_TEXT = 'Texto extraído por OCR de Gemini 2.0 Flash para medida legislativa.';

// ─── DB mock ──────────────────────────────────────────────────────────────────

interface MeasureRow { id: string; numero: string; source_url: string; }
interface VersionRow { id: string; hash: string; }

function makeDb(options: {
    measures?: MeasureRow[];
    currentVersion?: VersionRow | null;
} = {}) {
    return {
        query: jest.fn(async (sql: string, _params?: any[]) => {
            // findMeasuresNeedingExtraction
            if (sql.includes('LEFT JOIN bill_versions')) {
                return { rows: options.measures ?? [] };
            }
            // Check current version
            if (sql.includes('SELECT id, hash FROM bill_versions WHERE measure_id')) {
                return { rows: options.currentVersion ? [options.currentVersion] : [] };
            }
            // Mark old versions non-current
            if (sql.includes('UPDATE bill_versions SET is_current = false')) {
                return { rows: [] };
            }
            // Insert new version
            if (sql.includes('INSERT INTO bill_versions')) {
                return { rows: [] };
            }
            return { rows: [] };
        }),
    };
}

function makeRecorder() {
    return {
        start: jest.fn().mockResolvedValue('run-billtext-001'),
        complete: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BillTextScraper — runPipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: axios returns PDF buffer
        mockedAxios.get = jest.fn().mockResolvedValue({ data: SAMPLE_PDF_BUFFER });
        // Default: pdf-parse extracts text successfully
        mockPdfParse.mockResolvedValue({ text: EXTRACTED_TEXT });
    });

    it('returns a valid PipelineResult', async () => {
        const db = makeDb({ measures: [{ id: 'm1', numero: 'PS1234', source_url: 'https://sutra.oslpr.org/pdfs/PS1234.pdf' }] });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.scraperName).toBe('bill-text');
        expect(typeof result.recordsScraped).toBe('number');
        expect(typeof result.recordsNew).toBe('number');
        expect(typeof result.recordsUpdated).toBe('number');
        expect(typeof result.durationMs).toBe('number');
    });

    it('records run start and completion', async () => {
        const db = makeDb({ measures: [] });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        await scraper.runPipeline();

        expect(recorder.start).toHaveBeenCalledWith('bill-text');
        expect(recorder.complete).toHaveBeenCalledTimes(1);
        expect(recorder.fail).not.toHaveBeenCalled();
    });

    it('returns zero counts when no measures need extraction', async () => {
        const db = makeDb({ measures: [] });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsScraped).toBe(0);
        expect(result.recordsNew).toBe(0);
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('returns error result (not throw) on fatal DB failure', async () => {
        const db = {
            query: jest.fn().mockRejectedValue(new Error('Connection refused')),
        };
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.error).toBeDefined();
        expect(result.recordsScraped).toBe(0);
    });
});

describe('BillTextScraper — extractAndVersion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.get = jest.fn().mockResolvedValue({ data: SAMPLE_PDF_BUFFER });
        mockPdfParse.mockResolvedValue({ text: EXTRACTED_TEXT });
    });

    it('returns "new" when no current version exists', async () => {
        const db = makeDb({ currentVersion: null });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('new');

        const versionInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('INSERT INTO bill_versions'),
        );
        expect(versionInserts.length).toBe(1);
    });

    it('returns "updated" when hash changes', async () => {
        const db = makeDb({ currentVersion: { id: 'v1', hash: 'old-hash-does-not-match' } });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('updated');

        // Should mark previous version non-current
        const markOld = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('UPDATE bill_versions SET is_current = false'),
        );
        expect(markOld.length).toBe(1);

        // Should insert new version
        const versionInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('INSERT INTO bill_versions'),
        );
        expect(versionInserts.length).toBe(1);
    });

    it('returns "unchanged" when hash matches', async () => {
        // Compute what the actual hash will be
        const crypto = require('crypto');
        const realHash = crypto.createHash('sha256').update(EXTRACTED_TEXT).digest('hex');

        const db = makeDb({ currentVersion: { id: 'v1', hash: realHash } });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('unchanged');

        const versionInserts = (db.query as jest.Mock).mock.calls.filter(
            ([sql]: [string]) => sql.includes('INSERT INTO bill_versions'),
        );
        expect(versionInserts.length).toBe(0);
    });

    it('returns "unchanged" when PDF download fails', async () => {
        mockedAxios.get = jest.fn().mockRejectedValue(new Error('Network timeout'));
        const db = makeDb({ currentVersion: null });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('unchanged');
    });
});

describe('BillTextScraper — OCR fallback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.get = jest.fn().mockResolvedValue({ data: SAMPLE_PDF_BUFFER });
    });

    it('falls back to Gemini OCR when pdf-parse returns empty text', async () => {
        // pdf-parse returns nothing
        mockPdfParse.mockResolvedValue({ text: '' });

        // Gemini returns text
        const geminiResponse = {
            data: {
                candidates: [{ content: { parts: [{ text: GEMINI_TEXT }] } }],
            },
        };
        mockedAxios.post = jest.fn().mockResolvedValue(geminiResponse);

        process.env.GEMINI_API_KEY = 'test-api-key';
        const db = makeDb({ currentVersion: null });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('new');
        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('gemini'),
            expect.objectContaining({ contents: expect.any(Array) }),
            expect.any(Object),
        );

        delete process.env.GEMINI_API_KEY;
    });

    it('skips Gemini OCR when GEMINI_API_KEY is not set', async () => {
        mockPdfParse.mockResolvedValue({ text: '' });
        delete process.env.GEMINI_API_KEY;

        mockedAxios.post = jest.fn();
        const db = makeDb({ currentVersion: null });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('unchanged'); // No text extracted → unchanged
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('returns "unchanged" when both pdf-parse and Gemini return empty text', async () => {
        mockPdfParse.mockResolvedValue({ text: '   ' }); // Whitespace only
        process.env.GEMINI_API_KEY = 'test-key';
        mockedAxios.post = jest.fn().mockResolvedValue({
            data: { candidates: [{ content: { parts: [{ text: '' }] } }] },
        });

        const db = makeDb({ currentVersion: null });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('unchanged');
        delete process.env.GEMINI_API_KEY;
    });

    it('continues when Gemini API call fails', async () => {
        mockPdfParse.mockResolvedValue({ text: '' });
        process.env.GEMINI_API_KEY = 'test-key';
        mockedAxios.post = jest.fn().mockRejectedValue(new Error('Gemini API 503'));

        const db = makeDb({ currentVersion: null });
        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        // Should not throw
        const result = await scraper.extractAndVersion({
            id: 'm1',
            numero: 'PS1234',
            source_url: 'https://example.com/PS1234.pdf',
        });

        expect(result).toBe('unchanged');
        delete process.env.GEMINI_API_KEY;
    });
});

describe('BillTextScraper — pipeline counts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.get = jest.fn().mockResolvedValue({ data: SAMPLE_PDF_BUFFER });
        mockPdfParse.mockResolvedValue({ text: EXTRACTED_TEXT });
    });

    it('counts new, updated, and total correctly', async () => {
        const crypto = require('crypto');
        const realHash = crypto.createHash('sha256').update(EXTRACTED_TEXT).digest('hex');

        const measures = [
            { id: 'new-m', numero: 'PS100', source_url: 'https://example.com/PS100.pdf' },    // new
            { id: 'upd-m', numero: 'PS200', source_url: 'https://example.com/PS200.pdf' },   // updated
            { id: 'unc-m', numero: 'PS300', source_url: 'https://example.com/PS300.pdf' },   // unchanged
        ];

        const db = {
            query: jest.fn(async (sql: string, params?: any[]) => {
                if (sql.includes('LEFT JOIN bill_versions')) return { rows: measures };
                if (sql.includes('SELECT id, hash FROM bill_versions WHERE measure_id')) {
                    const measureId = params?.[0];
                    if (measureId === 'new-m') return { rows: [] };             // no version
                    if (measureId === 'upd-m') return { rows: [{ id: 'v1', hash: 'stale-hash' }] };
                    if (measureId === 'unc-m') return { rows: [{ id: 'v2', hash: realHash }] }; // same
                    return { rows: [] };
                }
                return { rows: [] };
            }),
        };

        const recorder = makeRecorder();
        const scraper = new BillTextScraper(db as any, recorder as any);

        const result = await scraper.runPipeline();

        expect(result.recordsScraped).toBe(3);
        expect(result.recordsNew).toBe(1);
        expect(result.recordsUpdated).toBe(1);
    });
});
