import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../modules/database/database.service';
import { ScraperHttpClient } from '../scraper-http.client';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { BaseScraper, PipelineResult } from '../base-scraper';
import { ChangeEventService } from '../change-event/change-event.service';

interface RawCommittee {
    name: string;
    chamber: 'upper' | 'lower' | 'joint';
    type: string;
    chair_name?: string;
    member_names: string[];
    source_url: string;
    detail_url?: string;
}

@Injectable()
export class CommitteesScraper implements BaseScraper {
    private readonly logger = new Logger(CommitteesScraper.name);
    readonly scraperName = 'committees';

    constructor(
        private readonly db: DatabaseService,
        private readonly http: ScraperHttpClient,
        private readonly recorder: ScraperRunRecorder,
        @Optional() private readonly changeEvents?: ChangeEventService,
    ) {}

    async runPipeline(): Promise<PipelineResult> {
        const startTime = Date.now();
        const runId = await this.recorder.start(this.scraperName);

        try {
            this.logger.log('Starting committees scraping pipeline...');
            const raw = await this.scrape();
            this.logger.log(`Scraped ${raw.length} raw committees`);

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
            throw error;
        }
    }

    private async scrape(): Promise<RawCommittee[]> {
        const committees: RawCommittee[] = [];

        const sources = [
            { url: 'https://senado.pr.gov/comisiones', chamber: 'upper' as const },
            { url: 'https://camara.registrok12.com/comisiones/', chamber: 'lower' as const },
        ];

        for (const source of sources) {
            try {
                const chamberCommittees = await this.scrapeChamberCommittees(source.url, source.chamber);
                committees.push(...chamberCommittees);
                this.logger.log(`${source.chamber}: scraped ${chamberCommittees.length} committees`);
            } catch (err: any) {
                this.logger.error(`${source.chamber} committees scrape failed: ${err.message}`);
            }
        }

        return committees;
    }

    private async scrapeChamberCommittees(listUrl: string, chamber: 'upper' | 'lower'): Promise<RawCommittee[]> {
        const $ = await this.http.getHtml(listUrl);
        const committees: RawCommittee[] = [];

        // Try to find committee list items
        const selectors = [
            '.item-cate', '.comision-item', '.committee-item', '.comisiones-list li',
            'article.comision', '.wp-block-columns .wp-block-column',
            'ul.comisiones li', 'table.comisiones tr',
        ];

        let items: any = $();
        for (const sel of selectors) {
            items = $(sel);
            if (items.length > 2) break;
        }

        if (items.length === 0) {
            // Fallback: look for links containing "comisión" text
            $('a').each((_, link) => {
                const text = $(link).text().trim();
                const href = $(link).attr('href') || '';
                if ((text.toLowerCase().includes('comisión') || text.toLowerCase().includes('comision')) && 
                    text.length > 10 && text.length < 100 &&
                    !text.toLowerCase().includes('asistencia') && 
                    !text.toLowerCase().includes('audiencia') &&
                    !text.toLowerCase().includes('calendario')) {
                    committees.push({
                        name: text.replace(/Comisión\s+de\s+/i, 'Comisión de ').trim(),
                        chamber,
                        type: 'standing',
                        member_names: [],
                        source_url: listUrl,
                        detail_url: href.startsWith('http') ? href : href ? new URL(href, listUrl).href : undefined,
                    });
                }
            });
        } else {
            items.each((_: number, item: any) => {
                const $item = $(item);
                const nameSelectors = ['h3 a', 'h2 a', 'h3', 'h2', 'h4', '.name', 'a', 'strong'];
                let name = '';
                let href = '';
                
                for (const sel of nameSelectors) {
                    const $el = $item.find(sel).first();
                    name = $el.text().trim();
                    if (name.length > 5) {
                        href = $el.attr('href') || $item.find('a').first().attr('href') || '';
                        break;
                    }
                }
                
                if (!name || name.toLowerCase().includes('asistencia')) return;

                const detailUrl = href
                    ? href.startsWith('http') ? href : new URL(href, listUrl).href
                    : undefined;

                committees.push({
                    name: name.trim(),
                    chamber,
                    type: this.detectType(name),
                    member_names: [],
                    source_url: listUrl,
                    detail_url: detailUrl,
                });
            });
        }

        // Enrich with detail pages
        const enriched: RawCommittee[] = [];
        for (const committee of committees) {
            if (committee.detail_url) {
                try {
                    const detail = await this.scrapeCommitteeDetail(committee.detail_url, committee);
                    enriched.push(detail);
                } catch (err: any) {
                    this.logger.warn(`Committee detail failed for "${committee.name}": ${err.message}`);
                    enriched.push(committee);
                }
            } else {
                enriched.push(committee);
            }
        }

        return enriched;
    }

    private async scrapeCommitteeDetail(url: string, base: RawCommittee): Promise<RawCommittee> {
        const $ = await this.http.getHtml(url);
        const members: string[] = [];
        let chairName: string | undefined = base.chair_name;

        // New House portal selectors
        if (url.includes('registrok12.com')) {
            $('.item-member h4').each((_, el) => {
                const text = $(el).text().trim();
                members.push(text);
                
                // Often the card has the role too, or the first card is the chair
                // But let's look for "Presidente" in the card text
                if ($(el).closest('.item-member').text().toLowerCase().includes('presidente')) {
                    chairName = text;
                }
            });
        }

        if (members.length === 0) {
            // Detect chair patterns if House portal didn't give it
            const chairPatterns = ['presidente', 'presidenta', 'chair', 'presidente de comisión'];
            $('*').each((_, el) => {
                const text = $(el).text().trim();
                const lower = text.toLowerCase();
                for (const pattern of chairPatterns) {
                    if (lower.includes(pattern) && text.length < 200) {
                        const next = $(el).next().text().trim();
                        if (next.length > 5 && next.length < 60) {
                            chairName = next;
                        }
                        break;
                    }
                }
            });

            // Detect member list patterns
            const memberSelectors = ['.miembro', '.member-name', 'li.legislator', '.committee-member'];
            for (const sel of memberSelectors) {
                $(sel).each((_, el) => {
                    const name = $(el).text().trim();
                    if (name.length > 5 && name.length < 80) members.push(name);
                });
                if (members.length > 0) break;
            }

            if (members.length === 0) {
                // Fallback: extract names from lists near "miembros" heading
                const bodyText = $('body').text();
                const membrosMatch = bodyText.match(/miembros?[:\s]+([^\.]{20,500})/i);
                if (membrosMatch) {
                    members.push(...membrosMatch[1].split('\n').map(s => s.trim()).filter(s => s.length > 5 && s.length < 80));
                }
            }
        }

        return {
            ...base,
            chair_name: chairName,
            member_names: members.length > 0 ? members : base.member_names,
            source_url: url,
        };
    }

    private async version(committees: RawCommittee[]): Promise<{ newCount: number; updatedCount: number }> {
        let newCount = 0;
        let updatedCount = 0;

        for (const c of committees) {
            const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            // Upsert committee
            const existing = await this.db.query(
                'SELECT id FROM committees WHERE chamber = $1 AND name = $2',
                [c.chamber, c.name]
            );

            let committeeId: string;

            if (existing.rows.length === 0) {
                // Resolve chair if we have a name
                const chairId = c.chair_name ? await this.resolveLegislatorId(c.chair_name, c.chamber) : null;

                const res = await this.db.query(
                    `INSERT INTO committees (name, slug, chamber, type, chair_id, source_url, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
                    [c.name, slug, c.chamber, c.type, chairId, c.source_url]
                );
                committeeId = res.rows[0].id;
                newCount++;
                await this.changeEvents?.record({
                    entityType: 'committee',
                    eventType: 'created',
                    entityId: committeeId,
                    scraperName: this.scraperName,
                    summary: `New committee: ${c.name} (${c.chamber})`,
                    after: { name: c.name, chamber: c.chamber, type: c.type, chair: c.chair_name },
                });
            } else {
                committeeId = existing.rows[0].id;

                // Update chair if changed
                if (c.chair_name) {
                    const chairId = await this.resolveLegislatorId(c.chair_name, c.chamber);
                    await this.db.query(
                        'UPDATE committees SET chair_id = $1, source_url = $2, updated_at = NOW() WHERE id = $3',
                        [chairId, c.source_url, committeeId]
                    );
                    updatedCount++;
                    await this.changeEvents?.record({
                        entityType: 'committee',
                        eventType: 'updated',
                        entityId: committeeId,
                        scraperName: this.scraperName,
                        summary: `Updated committee chair: ${c.name} → ${c.chair_name}`,
                        after: { name: c.name, chamber: c.chamber, chair: c.chair_name },
                    });
                }
            }

            // Refresh memberships — delete all and re-insert
            await this.db.query('DELETE FROM committee_memberships WHERE committee_id = $1', [committeeId]);

            for (const memberName of c.member_names) {
                const role = memberName === c.chair_name ? 'chair' : 'member';
                const legislatorId = await this.resolveLegislatorId(memberName, c.chamber);

                if (legislatorId) {
                    await this.db.query(
                        `INSERT INTO committee_memberships (committee_id, legislator_id, role)
                         VALUES ($1, $2, $3) ON CONFLICT (committee_id, legislator_id) DO UPDATE SET role = $3`,
                        [committeeId, legislatorId, role]
                    ).catch(() => {}); // Ignore duplicate errors
                }
            }
        }

        return { newCount, updatedCount };
    }

    private async resolveLegislatorId(name: string, chamber: string): Promise<string | null> {
        const cleanName = name
            .replace(/^(Hon\.|Sen\.|Rep\.|Lcdo\.|Lcda\.|Sra\.|Sr\.)/i, '')
            .replace(/[«»“”‘’'"]/g, '') // remove all types of quotes/nicknames
            .toLowerCase()
            .trim();

        // 1. Exact match
        let res = await this.db.query(
            'SELECT id FROM legislators WHERE (LOWER(full_name) = $1 OR REPLACE(REPLACE(LOWER(full_name), \'«\', \'\'), \'»\', \'\') = $1) AND chamber = $2',
            [cleanName, chamber]
        );
        if (res.rows.length > 0) return res.rows[0].id;

        // 2. Contains match
        res = await this.db.query(
            'SELECT id FROM legislators WHERE (LOWER(full_name) LIKE $1 OR $1 LIKE \'%\' || LOWER(full_name) || \'%\') AND chamber = $2 LIMIT 1',
            [`%${cleanName}%`, chamber]
        );
        if (res.rows.length > 0) return res.rows[0].id;

        // 3. Part-based match (smartest)
        const parts = cleanName.split(/\s+/).filter(p => p.length > 2);
        if (parts.length >= 2) {
            // Check if all parts of the cleaned name are present in some legislator name
            const allLegs = await this.db.query('SELECT id, full_name FROM legislators WHERE chamber = $1', [chamber]);
            for (const leg of allLegs.rows) {
                const lName = leg.full_name.toLowerCase();
                if (parts.every(p => lName.includes(p))) {
                    return leg.id;
                }
            }
        }

        return null;
    }

    private detectType(name: string): string {
        const lower = name.toLowerCase();
        if (lower.includes('conjunta') || lower.includes('joint')) return 'joint';
        if (lower.includes('especial') || lower.includes('special')) return 'special';
        if (lower.includes('conferencia') || lower.includes('conference')) return 'conference';
        return 'standing';
    }
}
