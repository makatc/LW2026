import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { chromium, Browser } from 'playwright';
import { DatabaseService } from '../../modules/database/database.service';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { BaseScraper, PipelineResult } from '../base-scraper';
import { ChangeEventService } from '../change-event/change-event.service';

interface RawVote {
    measure_numero: string;
    vote_date?: string;
    motion_text: string;
    result?: 'pass' | 'fail';
    yea_count: number;
    nay_count: number;
    abstain_count: number;
    other_count: number;
    chamber: 'upper' | 'lower';
    source_url: string;
    individual_votes: RawIndividualVote[];
}

interface RawIndividualVote {
    legislator_name: string;
    option: 'yea' | 'nay' | 'abstain' | 'other';
}

@Injectable()
export class VotesScraper implements BaseScraper {
    private readonly logger = new Logger(VotesScraper.name);
    readonly scraperName = 'votes';
    private browser?: Browser;

    constructor(
        private readonly db: DatabaseService,
        private readonly recorder: ScraperRunRecorder,
        @Optional() private readonly changeEvents?: ChangeEventService,
    ) {}

    async runPipeline(): Promise<PipelineResult> {
        const startTime = Date.now();
        const runId = await this.recorder.start(this.scraperName);

        try {
            this.logger.log('Starting votes scraping pipeline...');
            const raw = await this.scrape();
            this.logger.log(`Scraped ${raw.length} raw votes`);

            const { newCount, updatedCount } = await this.version(raw);

            await this.recorder.complete(runId, raw.length, newCount, updatedCount);
            return {
                scraperName: this.scraperName,
                recordsScraped: raw.length,
                recordsNew: newCount,
                recordsUpdated: updatedCount,
                durationMs: Date.now() - startTime,
            };
        } catch (error: any) {
            this.logger.error('Pipeline failed:', error.message);
            await this.recorder.fail(runId, error.message);
            // Don't rethrow — votes are optional, pipeline continues
            return {
                scraperName: this.scraperName,
                recordsScraped: 0,
                recordsNew: 0,
                recordsUpdated: 0,
                durationMs: Date.now() - startTime,
                error: error.message,
            };
        } finally {
            if (this.browser) {
                await this.browser.close();
                this.browser = undefined;
            }
        }
    }

    private async scrape(): Promise<RawVote[]> {
        // Vote data in SUTRA is embedded in measure detail pages under "Historial de Votaciones"
        // Strategy: scan recent measures and check each for vote data
        const votes: RawVote[] = [];

        const measuresRes = await this.db.query(
            `SELECT id, numero, source_url FROM sutra_measures ORDER BY updated_at DESC LIMIT 50`
        );

        if (measuresRes.rows.length === 0) {
            this.logger.warn('No measures found to check for votes');
            return votes;
        }

        const browser = await this.ensureBrowser();

        for (const measure of measuresRes.rows) {
            try {
                const measureVotes = await this.scrapeVotesForMeasure(browser, measure.numero, measure.source_url);
                votes.push(...measureVotes);
            } catch (err: any) {
                this.logger.debug(`No votes found for ${measure.numero}: ${err.message}`);
            }
        }

        return votes;
    }

    private async scrapeVotesForMeasure(browser: Browser, numero: string, url: string): Promise<RawVote[]> {
        const page = await browser.newPage();
        const votes: RawVote[] = [];

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            const rawVotes = await page.evaluate(() => {
                const bodyText = document.body.innerText;

                // Check if there's any vote/votación content
                if (!bodyText.match(/votaci[oó]n|votos|vot[oó]/i)) {
                    return null;
                }

                // Try to extract vote summary counts
                const yeaMatch = bodyText.match(/a favor[:\s]+(\d+)/i) || bodyText.match(/ayes?[:\s]+(\d+)/i);
                const nayMatch = bodyText.match(/en contra[:\s]+(\d+)/i) || bodyText.match(/nays?[:\s]+(\d+)/i);
                const abstainMatch = bodyText.match(/abstenci[oó]n[:\s]+(\d+)/i) || bodyText.match(/abstenidos?[:\s]+(\d+)/i);

                if (!yeaMatch && !nayMatch) return null;

                // Try to determine result
                const passMatch = bodyText.match(/aprobado|aprobada|passed|approved/i);
                const failMatch = bodyText.match(/rechazado|rechazada|failed|derrotado/i);

                // Extract date
                const dateMatch = bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);

                // Extract chamber from text
                const isSenate = bodyText.match(/senado/i);

                // Individual votes (names with their vote options)
                const individualVotes: any[] = [];

                // Try to find table rows with legislator names and vote options
                const rows = Array.from(document.querySelectorAll('table tr'));
                rows.forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length >= 2) {
                        const name = cells[0].textContent?.trim();
                        const voteText = cells[1].textContent?.trim().toLowerCase() || '';
                        if (name && name.length > 3) {
                            let option: string = 'other';
                            if (voteText.includes('favor') || voteText.includes('aye') || voteText === 'sí' || voteText === 'si') option = 'yea';
                            else if (voteText.includes('contra') || voteText.includes('nay') || voteText === 'no') option = 'nay';
                            else if (voteText.includes('absten')) option = 'abstain';
                            individualVotes.push({ legislator_name: name, option });
                        }
                    }
                });

                return {
                    yea_count: yeaMatch ? parseInt(yeaMatch[1]) : (individualVotes.filter(v => v.option === 'yea').length),
                    nay_count: nayMatch ? parseInt(nayMatch[1]) : (individualVotes.filter(v => v.option === 'nay').length),
                    abstain_count: abstainMatch ? parseInt(abstainMatch[1]) : 0,
                    other_count: 0,
                    result: passMatch ? 'pass' : failMatch ? 'fail' : undefined,
                    vote_date: dateMatch ? dateMatch[0] : undefined,
                    motion_text: `Votación - ${document.title || 'Medida'}`,
                    chamber: isSenate ? 'upper' : 'lower',
                    individual_votes: individualVotes,
                };
            });

            if (rawVotes) {
                votes.push({
                    ...rawVotes,
                    measure_numero: numero,
                    source_url: url,
                } as RawVote);
            }
        } catch (err: any) {
            this.logger.debug(`Vote scrape failed for ${url}: ${err.message}`);
        } finally {
            await page.close();
        }

        return votes;
    }

    private async version(votes: RawVote[]): Promise<{ newCount: number; updatedCount: number }> {
        let newCount = 0;
        let updatedCount = 0;

        for (const vote of votes) {
            try {
                // Find measure ID
                const measureRes = await this.db.query(
                    'SELECT id FROM sutra_measures WHERE numero = $1',
                    [vote.measure_numero]
                );
                const measureId = measureRes.rows[0]?.id || null;

                const hashInput = `${vote.measure_numero}:${vote.vote_date}:${vote.motion_text}`;
                const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

                const existing = await this.db.query('SELECT id FROM votes WHERE hash = $1', [hash]);
                if (existing.rows.length > 0) continue; // Already recorded

                // Normalize date
                let voteDate: string | null = null;
                if (vote.vote_date) {
                    const parts = vote.vote_date.includes('/') ? vote.vote_date.split('/') : null;
                    if (parts && parts.length === 3) {
                        voteDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                    } else {
                        voteDate = vote.vote_date;
                    }
                }

                const voteRes = await this.db.query(
                    `INSERT INTO votes (measure_id, vote_date, motion_text, result, yea_count, nay_count, abstain_count, other_count, chamber, hash, source_url)
                     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     ON CONFLICT (hash) DO NOTHING
                     RETURNING id`,
                    [measureId, voteDate, vote.motion_text, vote.result || null,
                     vote.yea_count, vote.nay_count, vote.abstain_count, vote.other_count,
                     vote.chamber, hash, vote.source_url]
                );

                if (voteRes.rows.length === 0) continue;
                const voteId = voteRes.rows[0].id;
                newCount++;
                await this.changeEvents?.record({
                    entityType: 'vote',
                    eventType: 'created',
                    entityId: voteId,
                    scraperName: this.scraperName,
                    summary: `New vote on ${vote.measure_numero}: ${vote.result ?? 'pending'} (${vote.yea_count}–${vote.nay_count})`,
                    after: {
                        measure_numero: vote.measure_numero,
                        result: vote.result,
                        yea_count: vote.yea_count,
                        nay_count: vote.nay_count,
                        chamber: vote.chamber,
                    },
                });

                // Insert individual votes
                for (const iv of vote.individual_votes) {
                    const legRes = await this.db.query(
                        `SELECT id FROM legislators WHERE full_name ILIKE $1 AND chamber = $2 LIMIT 1`,
                        [iv.legislator_name, vote.chamber]
                    );
                    const legislatorId = legRes.rows[0]?.id || null;

                    await this.db.query(
                        `INSERT INTO individual_votes (vote_id, legislator_id, legislator_name, option)
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT (vote_id, legislator_id) DO NOTHING`,
                        [voteId, legislatorId, iv.legislator_name, iv.option]
                    ).catch(() => {});
                }
            } catch (err: any) {
                this.logger.error(`Failed to version vote for ${vote.measure_numero}: ${err.message}`);
            }
        }

        return { newCount, updatedCount };
    }

    private async ensureBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
        }
        return this.browser;
    }
}
