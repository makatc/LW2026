/**
 * Unit tests for ScraperSchedulerService
 *
 * Tests the enable/disable logic, per-scraper dispatch, full-pipeline
 * concurrency guard, and error isolation — without real cron timers or
 * a running NestJS application.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScraperSchedulerService } from '../scraper-scheduler.service';
import { PipelineService } from '../../pipeline/pipeline.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePipelineResult(scraperName: string, opts: Partial<any> = {}) {
    return {
        scraperName,
        recordsScraped: 10,
        recordsNew: 3,
        recordsUpdated: 2,
        durationMs: 500,
        ...opts,
    };
}

function makeFullResult() {
    return {
        legislators: makePipelineResult('legislators'),
        committees: makePipelineResult('committees'),
        bills: makePipelineResult('bills'),
        votes: makePipelineResult('votes'),
        durationMs: 2000,
    };
}

async function buildService(envOverrides: Record<string, string | undefined> = {}) {
    // Apply env overrides
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(envOverrides)) {
        saved[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }

    const mockPipeline = {
        runSingle: jest.fn().mockImplementation((name: string) =>
            Promise.resolve(makePipelineResult(name)),
        ),
        runFull: jest.fn().mockResolvedValue(makeFullResult()),
    };

    const module: TestingModule = await Test.createTestingModule({
        providers: [
            ScraperSchedulerService,
            { provide: PipelineService, useValue: mockPipeline },
        ],
    }).compile();

    const service = module.get(ScraperSchedulerService);

    return { service, mockPipeline, restore: () => {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }};
}

// ─── Enable/disable logic ─────────────────────────────────────────────────────

describe('ScraperSchedulerService — enable/disable', () => {
    afterEach(() => {
        delete process.env.SCRAPER_CRON_ENABLED;
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_URL;
    });

    it('is ENABLED when SCRAPER_CRON_ENABLED=true', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'true',
            REDIS_HOST: 'localhost', // Redis present but flag overrides
        });
        await service.runBills();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('bills');
        restore();
    });

    it('is DISABLED when SCRAPER_CRON_ENABLED=false', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'false',
        });
        await service.runBills();
        expect(mockPipeline.runSingle).not.toHaveBeenCalled();
        restore();
    });

    it('auto-ENABLED when no REDIS_HOST and no REDIS_URL and flag not set', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: undefined,
            REDIS_HOST: undefined,
            REDIS_URL: undefined,
        });
        await service.runBills();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('bills');
        restore();
    });

    it('auto-DISABLED when REDIS_HOST is set and flag not set', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: undefined,
            REDIS_HOST: 'localhost',
        });
        await service.runBills();
        expect(mockPipeline.runSingle).not.toHaveBeenCalled();
        restore();
    });

    it('auto-DISABLED when REDIS_URL is set and flag not set', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: undefined,
            REDIS_URL: 'redis://localhost:6380',
            REDIS_HOST: undefined,
        });
        await service.runBills();
        expect(mockPipeline.runSingle).not.toHaveBeenCalled();
        restore();
    });
});

// ─── Per-scraper dispatch ────────────────────────────────────────────────────

describe('ScraperSchedulerService — per-scraper dispatch', () => {
    let service: ScraperSchedulerService;
    let mockPipeline: any;
    let restore: () => void;

    beforeEach(async () => {
        ({ service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'true',
        }));
    });

    afterEach(() => restore());

    it('runLegislators calls pipeline.runSingle("legislators")', async () => {
        await service.runLegislators();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('legislators');
    });

    it('runCommittees calls pipeline.runSingle("committees")', async () => {
        await service.runCommittees();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('committees');
    });

    it('runBills calls pipeline.runSingle("bills")', async () => {
        await service.runBills();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('bills');
    });

    it('runVotes calls pipeline.runSingle("votes")', async () => {
        await service.runVotes();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('votes');
    });

    it('runBillText calls pipeline.runSingle("bill-text")', async () => {
        await service.runBillText();
        expect(mockPipeline.runSingle).toHaveBeenCalledWith('bill-text');
    });

    it('runFullPipeline calls pipeline.runFull()', async () => {
        await service.runFullPipeline();
        expect(mockPipeline.runFull).toHaveBeenCalledTimes(1);
    });
});

// ─── Error isolation ─────────────────────────────────────────────────────────

describe('ScraperSchedulerService — error isolation', () => {
    let service: ScraperSchedulerService;
    let mockPipeline: any;
    let restore: () => void;

    beforeEach(async () => {
        ({ service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'true',
        }));
    });

    afterEach(() => restore());

    it('runSingle does not throw when pipeline.runSingle rejects', async () => {
        mockPipeline.runSingle.mockRejectedValueOnce(new Error('Network timeout'));
        await expect(service.runBills()).resolves.toBeUndefined();
    });

    it('runFullPipeline does not throw when pipeline.runFull rejects', async () => {
        mockPipeline.runFull.mockRejectedValueOnce(new Error('Playwright crashed'));
        await expect(service.runFullPipeline()).resolves.toBeUndefined();
    });

    it('running flag is reset to false after pipeline error', async () => {
        mockPipeline.runFull.mockRejectedValueOnce(new Error('crash'));
        await service.runFullPipeline();
        // If flag was NOT reset, this second call would be skipped
        await service.runFullPipeline();
        expect(mockPipeline.runFull).toHaveBeenCalledTimes(2);
    });
});

// ─── Concurrency guard ────────────────────────────────────────────────────────

describe('ScraperSchedulerService — concurrency guard (full pipeline)', () => {
    it('skips second runFullPipeline call if first is still running', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'true',
        });

        // Make the first runFull take a tick so we can overlap
        let resolveFirst!: () => void;
        const firstDone = new Promise<void>(r => { resolveFirst = r; });
        mockPipeline.runFull.mockReturnValueOnce(firstDone.then(() => makeFullResult()));

        // Start first — don't await yet
        const first = service.runFullPipeline();

        // Immediately trigger second while first is in progress
        await service.runFullPipeline();

        // Resolve first and finish
        resolveFirst();
        await first;

        // runFull should have been called only once
        expect(mockPipeline.runFull).toHaveBeenCalledTimes(1);
        restore();
    });

    it('allows second runFullPipeline after first completes', async () => {
        const { service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'true',
        });

        await service.runFullPipeline();
        await service.runFullPipeline();

        expect(mockPipeline.runFull).toHaveBeenCalledTimes(2);
        restore();
    });
});

// ─── Disabled: no calls at all ────────────────────────────────────────────────

describe('ScraperSchedulerService — fully disabled', () => {
    let service: ScraperSchedulerService;
    let mockPipeline: any;
    let restore: () => void;

    beforeEach(async () => {
        ({ service, mockPipeline, restore } = await buildService({
            SCRAPER_CRON_ENABLED: 'false',
        }));
    });

    afterEach(() => restore());

    it('no pipeline calls for any method when disabled', async () => {
        await service.runLegislators();
        await service.runCommittees();
        await service.runBills();
        await service.runVotes();
        await service.runBillText();
        await service.runFullPipeline();

        expect(mockPipeline.runSingle).not.toHaveBeenCalled();
        expect(mockPipeline.runFull).not.toHaveBeenCalled();
    });
});
