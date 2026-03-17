import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../modules/database/database.service';
import { ScraperHttpClient } from '../scraper-http.client';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { BaseScraper, PipelineResult } from '../base-scraper';
import { ChangeEventService } from '../change-event/change-event.service';

interface RawLegislator {
    full_name: string;
    chamber: 'upper' | 'lower';
    party?: string;
    district?: string;
    email?: string;
    phone?: string;
    office?: string;
    photo_url?: string;
    source_url: string;
    detail_url?: string;
}

@Injectable()
export class LegislatorsScraper implements BaseScraper {
    private readonly logger = new Logger(LegislatorsScraper.name);
    readonly scraperName = 'legislators';

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
            this.logger.log('Starting legislator scraping pipeline...');
            const raw = await this.scrape();
            this.logger.log(`Scraped ${raw.length} raw legislators`);

            const cleaned = this.clean(raw);
            const { newCount, updatedCount } = await this.version(cleaned);

            await this.recorder.complete(runId, cleaned.length, newCount, updatedCount);

            const result: PipelineResult = {
                scraperName: this.scraperName,
                recordsScraped: cleaned.length,
                recordsNew: newCount,
                recordsUpdated: updatedCount,
                durationMs: Date.now() - startTime,
            };
            this.logger.log(`Pipeline complete: ${newCount} new, ${updatedCount} updated`);
            return result;
        } catch (error: any) {
            this.logger.error('Pipeline failed:', error.message);
            await this.recorder.fail(runId, error.message);
            throw error;
        }
    }

    private async scrape(): Promise<RawLegislator[]> {
        const legislators: RawLegislator[] = [];

        // Scrape Senate
        try {
            const senadores = await this.scrapeChamber(
                'https://senado.pr.gov/senadores',
                'upper',
            );
            legislators.push(...senadores);
            this.logger.log(`Senate: scraped ${senadores.length} legislators`);
        } catch (err: any) {
            this.logger.error(`Senate scrape failed: ${err.message}`);
        }

        // Scrape House
        try {
            const representantes = await this.scrapeChamber(
                'https://camara.registrok12.com/representante/',
                'lower',
            );
            legislators.push(...representantes);
            this.logger.log(`House: scraped ${representantes.length} legislators`);
        } catch (err: any) {
            this.logger.error(`House scrape failed: ${err.message}`);
        }

        return legislators;
    }

    private async scrapeChamber(
        listUrl: string,
        chamber: 'upper' | 'lower',
    ): Promise<RawLegislator[]> {
        const $ = await this.http.getHtml(listUrl);
        const legislators: RawLegislator[] = [];

        // Try multiple selector patterns (sites may differ)
        const cardSelectors = [
            'a.row.liderato',
            'a.e-con.e-child',
            'div.team-member',
            '.elementor-element-populated',
            '.legislator-card',
            '.member-card',
            '.senador-card',
            '.representante-card',
            'article.member',
            '.wp-block-group',
            '.elementor-widget-wrap',
            'li.legislator',
        ];

        let found = false;
        for (const selector of cardSelectors) {
            const cards = $(selector);
            if (cards.length > 5) {
                this.logger.debug(`Using selector "${selector}" — found ${cards.length} cards`);
                cards.each((_, card) => {
                    const data = this.extractFromCard($, card, chamber, listUrl);
                    if (data) legislators.push(data);
                });
                found = true;
                break;
            }
        }

        if (!found) {
            // Fallback: look for links with legislator names in common patterns
            this.logger.warn(`No card selector matched for ${listUrl}. Trying link fallback...`);
            const links = $('a[href*="senador"], a[href*="representante"], a[href*="miembro"]');
            links.each((_, link) => {
                const name = $(link).text().trim();
                const href = $(link).attr('href');
                if (name.length > 5 && href) {
                    legislators.push({
                        full_name: this.normalizeName(name),
                        chamber,
                        source_url: listUrl,
                        detail_url: href.startsWith('http') ? href : new URL(href, listUrl).href,
                    });
                }
            });
        }

        // Enrich with detail pages (email, phone, office)
        const enriched: RawLegislator[] = [];
        for (const legislator of legislators) {
            if (legislator.detail_url) {
                try {
                    const detail = await this.scrapeDetail(legislator.detail_url, legislator);
                    enriched.push(detail);
                } catch (err: any) {
                    this.logger.warn(`Detail scrape failed for ${legislator.full_name}: ${err.message}`);
                    enriched.push(legislator); // Use what we have
                }
            } else {
                enriched.push(legislator);
            }
        }

        return enriched;
    }

    private extractFromCard($: any, card: any, chamber: 'upper' | 'lower', listUrl: string): RawLegislator | null {
        const $card = $(card);

        // Name extraction — try multiple patterns
        const nameSelectors = ['h2', 'h3', 'h4', '.name', '.card-title', '.legislator-name', 'strong'];
        let name = '';
        for (const sel of nameSelectors) {
            name = $card.find(sel).first().text().trim();
            if (name.length > 3) break;
        }
        if (!name) return null;

        // Party extraction
        const partyText = ($card.find('.party, .partido, .badge, .tag').first().text() ||
            $card.text()).trim();
        const party = this.extractParty(partyText);

        // District
        const districtText = $card.find('.district, .distrito, .distri').text().trim();

        // Photo
        const photoUrl = $card.find('img').first().attr('src') || undefined;

        // Detail link
        const detailLink = $card.is('a') ? $card.attr('href') : $card.find('a').first().attr('href');
        const detailUrl = detailLink
            ? detailLink.startsWith('http') ? detailLink : new URL(detailLink, listUrl).href
            : undefined;

        return {
            full_name: this.normalizeName(name),
            chamber,
            party,
            district: districtText || undefined,
            photo_url: photoUrl,
            source_url: listUrl,
            detail_url: detailUrl,
        };
    }

    private async scrapeDetail(url: string, base: RawLegislator): Promise<RawLegislator> {
        const $ = await this.http.getHtml(url);

        // Email
        const emailEl = $('a[href^="mailto:"]').first();
        const email = emailEl.attr('href')?.replace('mailto:', '').trim();

        // Phone - try tel: links first
        let phone = $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '').replace(/\s/g, '');
        if (!phone) {
            // Fallback to regex across the page text
            const textMatch = $('body').text().match(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/);
            if (textMatch) {
                phone = `${textMatch[1]}-${textMatch[2]}-${textMatch[3]}`;
            }
        }

        // Office (room number often in a p or span near 'Oficina' label)
        // Improved regex to avoid capturing "Oficina de Servicios Legislativos"
        const officeText = $('body').text();
        const officeMatch = officeText.match(/Oficina[:\s]+((?!de Servicios Legislativos)[a-zA-Z0-9\-\s,]{1,30})(?:\n|$)/i);
        const office = officeMatch ? officeMatch[1].trim() : undefined;

        // Better photo from detail page
        const photo = $('img.photo, img.profile-photo, .wp-post-image, img[class*="profile"]').first().attr('src') || base.photo_url;

        return {
            ...base,
            email: email || base.email,
            phone: phone || base.phone,
            office: office || base.office,
            photo_url: photo,
            source_url: url,
        };
    }

    private clean(legislators: RawLegislator[]): RawLegislator[] {
        const seen = new Set<string>();
        const VALID_PARTIES = ['PNP', 'PPD', 'PIP', 'MVC', 'PD', 'IND'];
        return legislators
            .filter(l => l.full_name && l.full_name.length > 2)
            .map(l => ({
                ...l,
                full_name: this.normalizeName(l.full_name),
                party: l.party ? this.normalizeParty(l.party) : undefined,
                email: l.email?.toLowerCase().trim(),
                phone: l.phone?.replace(/[^\d+\-()]/g, ''),
            }))
            .filter(l => {
                // Skip entries where party was not recognized (garbage data)
                if (l.party && !VALID_PARTIES.includes(l.party)) {
                    this.logger.warn(`Skipping legislator with invalid party: ${l.full_name} (party: ${l.party})`);
                    return false;
                }
                const key = `${l.chamber}:${l.full_name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    private async version(legislators: RawLegislator[]): Promise<{ newCount: number; updatedCount: number }> {
        let newCount = 0;
        let updatedCount = 0;

        // Track which DB IDs are part of the current scrape
        const activeIds: string[] = [];

        for (const l of legislators) {
            const hash = crypto.createHash('sha256').update(JSON.stringify(l)).digest('hex');

            const existing = await this.db.query(
                'SELECT id, hash FROM legislators WHERE chamber = $1 AND full_name = $2',
                [l.chamber, l.full_name]
            );

            if (existing.rows.length === 0) {
                const ins = await this.db.query(
                    `INSERT INTO legislators
                        (full_name, chamber, party, district, email, phone, office, photo_url, is_active, source_url, hash, scraped_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, NOW())
                     RETURNING id`,
                    [l.full_name, l.chamber, l.party || null, l.district || null,
                     l.email || null, l.phone || null, l.office || null,
                     l.photo_url || null, l.source_url, hash]
                );
                const newId = ins.rows[0]?.id;
                if (newId) activeIds.push(newId);
                newCount++;
                await this.changeEvents?.record({
                    entityType: 'legislator',
                    eventType: 'created',
                    entityId: newId,
                    scraperName: this.scraperName,
                    summary: `New legislator: ${l.full_name} (${l.chamber}, ${l.party ?? 'no party'})`,
                    after: { full_name: l.full_name, chamber: l.chamber, party: l.party },
                });
            } else {
                const existingId = existing.rows[0].id;
                activeIds.push(existingId);
                if (existing.rows[0].hash !== hash) {
                    await this.db.query(
                        `UPDATE legislators SET
                            party = $1, district = $2, email = $3, phone = $4, office = $5,
                            photo_url = $6, source_url = $7, hash = $8, is_active = true,
                            scraped_at = NOW(), updated_at = NOW()
                         WHERE id = $9`,
                        [l.party || null, l.district || null, l.email || null,
                         l.phone || null, l.office || null, l.photo_url || null,
                         l.source_url, hash, existingId]
                    );
                    updatedCount++;
                    await this.changeEvents?.record({
                        entityType: 'legislator',
                        eventType: 'updated',
                        entityId: existingId,
                        scraperName: this.scraperName,
                        summary: `Updated legislator: ${l.full_name} (${l.chamber})`,
                        after: { full_name: l.full_name, chamber: l.chamber, party: l.party },
                    });
                } else {
                    // Ensure existing legislators seen in this scrape are marked active
                    await this.db.query(
                        'UPDATE legislators SET is_active = true WHERE id = $1 AND is_active = false',
                        [existingId]
                    );
                }
            }
        }

        // Mark any legislator NOT seen in this scrape as inactive (former incumbents)
        if (activeIds.length > 0) {
            const placeholders = activeIds.map((_, i) => `$${i + 1}`).join(', ');
            const deactivated = await this.db.query(
                `UPDATE legislators SET is_active = false, updated_at = NOW()
                 WHERE id NOT IN (${placeholders}) AND is_active = true
                 RETURNING full_name, chamber`,
                activeIds
            );
            if (deactivated.rows.length > 0) {
                this.logger.log(`Deactivated ${deactivated.rows.length} former legislators: ${deactivated.rows.map((r: any) => r.full_name).join(', ')}`);
            }
        }

        return { newCount, updatedCount };
    }

    // ─── Normalization helpers ────────────────────────────────────────────────

    private normalizeName(name: string): string {
        return name
            .replace(/\s+/g, ' ')
            .replace(/Hon\.\s*/i, '')
            .replace(/Dr\.\s*/i, '')
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }

    private normalizeParty(text: string): string {
        const upper = text.toUpperCase();
        if (upper.includes('PNP') || upper.includes('PROGRESISTA') || upper.includes('NUEVO PROGRESISTA')) return 'PNP';
        if (upper.includes('PPD') || upper.includes('POPULAR') || upper.includes('POPULAR DEMOCRÁTICO')) return 'PPD';
        if (upper.includes('PD') || upper.includes('DIGNIDAD')) return 'PD';
        if (upper.includes('MVC') || upper.includes('CIUDADANOS')) return 'MVC';
        if (upper.includes('PIP') || upper.includes('INDEPENDENTISTA')) return 'PIP';
        if (upper.includes('INDEPENDIENTE')) return 'IND';
        // Return empty string instead of garbage text — clean() will filter these out
        this.logger.debug(`Unknown party text: "${text.substring(0, 30)}"`);
        return '';
    }

    private extractParty(text: string): string | undefined {
        const party = this.normalizeParty(text);
        return party.length > 0 ? party : undefined;
    }
}
