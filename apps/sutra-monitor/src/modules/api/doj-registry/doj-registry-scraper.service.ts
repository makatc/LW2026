import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Task 6.1 — DOJ Registry Scraper Service
 *
 * Scrapes the public Registro de Cabilderos from the
 * Puerto Rico Department of Justice website.
 *
 * DOJ Public Registry URL:
 * https://www.justicia.pr.gov/ → Registro de Cabilderos
 *
 * This scraper:
 * 1. Fetches the public registry page
 * 2. Parses registered lobbyists/firms
 * 3. Stores data in doj_registry_entries table
 * 4. Provides cross-reference capabilities with legislators
 *
 * NOTE: The DOJ website structure may change. The scraper uses
 * multiple strategies and graceful fallbacks.
 */
@Injectable()
export class DojRegistryScraperService {
    private readonly logger = new Logger(DojRegistryScraperService.name);

    // Known DOJ registry URLs (multiple fallbacks)
    private readonly registryUrls = [
        'https://www.justicia.pr.gov/registro-de-cabilderos/',
        'https://www.justicia.pr.gov/departamento/registro-cabilderos/',
        'https://www.justicia.pr.gov/servicios/registro-de-cabilderos/',
    ];

    constructor(private readonly db: DatabaseService) {}

    /**
     * Main scrape method: fetches and parses the DOJ registry.
     */
    async scrapeRegistry() {
        this.logger.log('🕷️ Starting DOJ Registry scrape...');

        // Ensure the storage table exists
        await this.ensureTable();

        let html: string | null = null;
        let usedUrl = '';

        // Try all known URLs
        for (const url of this.registryUrls) {
            try {
                this.logger.debug(`Trying: ${url}`);
                const response = await axios.get(url, {
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 LegalWatch/2.0',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'es-PR,es;q=0.9,en;q=0.8',
                    },
                    maxRedirects: 5,
                });

                if (response.status === 200 && response.data?.length > 1000) {
                    html = response.data;
                    usedUrl = url;
                    this.logger.log(`✅ Fetched DOJ registry from ${url} (${html!.length} bytes)`);
                    break;
                }
            } catch (err: any) {
                this.logger.debug(`URL failed: ${url} — ${err.message}`);
            }
        }

        if (!html) {
            this.logger.warn('⚠️ Could not reach DOJ registry. All URLs failed.');
            return {
                status: 'failed',
                message: 'Could not reach DOJ registry. The website may be down or URLs may have changed.',
                urls_tried: this.registryUrls,
            };
        }

        // Parse the HTML
        const entries = this.parseRegistryPage(html, usedUrl);
        this.logger.log(`📋 Parsed ${entries.length} registry entries`);

        // Store/update entries in DB
        let inserted = 0;
        let updated = 0;

        for (const entry of entries) {
            try {
                const result = await this.db.query(
                    `INSERT INTO doj_registry_entries
                     (lobbyist_name, firm_name, registration_number, status,
                      clients, legislators_declared, raw_data, source_url, last_scraped_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                     ON CONFLICT (lobbyist_name, COALESCE(firm_name, ''))
                     DO UPDATE SET
                         registration_number = COALESCE($3, doj_registry_entries.registration_number),
                         status = COALESCE($4, doj_registry_entries.status),
                         clients = COALESCE($5, doj_registry_entries.clients),
                         legislators_declared = COALESCE($6, doj_registry_entries.legislators_declared),
                         raw_data = $7,
                         source_url = $8,
                         last_scraped_at = NOW(),
                         updated_at = NOW()
                     RETURNING (xmax = 0) AS is_new`,
                    [
                        entry.lobbyist_name,
                        entry.firm_name || null,
                        entry.registration_number || null,
                        entry.status || 'active',
                        JSON.stringify(entry.clients || []),
                        JSON.stringify(entry.legislators_declared || []),
                        JSON.stringify(entry),
                        usedUrl,
                    ],
                );
                if (result.rows[0]?.is_new) inserted++;
                else updated++;
            } catch (err: any) {
                this.logger.debug(`Failed to upsert entry ${entry.lobbyist_name}: ${err.message}`);
            }
        }

        const scrapeResult = {
            status: 'success',
            source_url: usedUrl,
            total_entries: entries.length,
            inserted,
            updated,
            scraped_at: new Date().toISOString(),
        };

        this.logger.log(`✅ DOJ scrape complete: ${inserted} new, ${updated} updated`);
        return scrapeResult;
    }

    /**
     * Get all lobbyists from stored data.
     */
    async getLobbyists(search?: string) {
        await this.ensureTable();

        let query = 'SELECT * FROM doj_registry_entries';
        const params: any[] = [];

        if (search) {
            query += ` WHERE lobbyist_name ILIKE $1
                          OR firm_name ILIKE $1
                          OR clients::text ILIKE $1`;
            params.push(`%${search}%`);
        }

        query += ' ORDER BY lobbyist_name ASC LIMIT 100';

        const res = await this.db.query(query, params);
        return { data: res.rows, total: res.rows.length };
    }

    /**
     * Get lobbyists who declared activity with a specific legislator.
     */
    async getLobbyistsForLegislator(legislatorName: string) {
        await this.ensureTable();

        if (!legislatorName) return { data: [], total: 0 };

        const res = await this.db.query(
            `SELECT * FROM doj_registry_entries
             WHERE legislators_declared::text ILIKE $1
             ORDER BY lobbyist_name ASC`,
            [`%${legislatorName}%`],
        );

        return {
            legislator_name: legislatorName,
            data: res.rows,
            total: res.rows.length,
        };
    }

    /**
     * Get last scrape info.
     */
    async getLastScrapeInfo() {
        await this.ensureTable();

        const res = await this.db.query(
            `SELECT
                COUNT(*) AS total_entries,
                MAX(last_scraped_at) AS last_scraped_at,
                MIN(last_scraped_at) AS oldest_entry,
                COUNT(*) FILTER (WHERE status = 'active') AS active,
                COUNT(*) FILTER (WHERE status != 'active') AS inactive
             FROM doj_registry_entries`,
        );

        return res.rows[0] || {
            total_entries: 0,
            last_scraped_at: null,
        };
    }

    // ─── Private: HTML Parsing ────────────────────────────────────────────────

    /**
     * Parse the DOJ registry HTML page.
     *
     * DOJ pages typically present registry data in tables or lists.
     * We try multiple parsing strategies since the format may vary.
     */
    private parseRegistryPage(html: string, sourceUrl: string): any[] {
        const $ = cheerio.load(html);
        const entries: any[] = [];

        // Strategy 1: Look for data tables
        $('table').each((_, table) => {
            const rows = $(table).find('tr');
            if (rows.length < 2) return; // Skip tables without data

            const headers: string[] = [];
            $(rows[0]).find('th, td').each((_, cell) => {
                headers.push($(cell).text().trim().toLowerCase());
            });

            // Check if this looks like a registry table
            const isRegistry = headers.some(h =>
                h.includes('nombre') || h.includes('cabildero') ||
                h.includes('firma') || h.includes('registro') ||
                h.includes('lobbyist')
            );

            if (!isRegistry && headers.length > 0) return;

            rows.slice(1).each((_, row) => {
                const cells: string[] = [];
                $(row).find('td').each((_, cell) => {
                    cells.push($(cell).text().trim());
                });

                if (cells.length >= 2 && cells[0]) {
                    entries.push({
                        lobbyist_name: cells[0],
                        firm_name: cells[1] || null,
                        registration_number: cells[2] || null,
                        status: cells[3]?.toLowerCase().includes('activ') ? 'active' : (cells[3] || 'unknown'),
                        clients: this.parseClients(cells[4] || ''),
                        legislators_declared: this.parseLegislatorNames(cells[5] || ''),
                    });
                }
            });
        });

        // Strategy 2: Look for structured lists/divs
        if (entries.length === 0) {
            $('div.entry, div.cabildero, li.lobby-entry, article.registro').each((_, el) => {
                const name = $(el).find('.nombre, .name, h3, h4, strong').first().text().trim();
                const firm = $(el).find('.firma, .firm, .empresa').first().text().trim();
                const regNum = $(el).find('.numero, .registration').first().text().trim();

                if (name) {
                    entries.push({
                        lobbyist_name: name,
                        firm_name: firm || null,
                        registration_number: regNum || null,
                        status: 'active',
                        clients: [],
                        legislators_declared: [],
                    });
                }
            });
        }

        // Strategy 3: Look for any text-heavy content that resembles a list
        if (entries.length === 0) {
            const contentText = $('main, .content, .entry-content, article, #content')
                .first().text();
            if (contentText) {
                // Try to parse line-by-line
                const lines = contentText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 5 && l.length < 200);

                for (const line of lines) {
                    // Look for patterns like "Name - Firm" or "Name | Firm"
                    const parts = line.split(/\s*[-–—|]\s*/);
                    if (parts.length >= 2 && parts[0].match(/^[A-ZÁÉÍÓÚÑ]/)) {
                        entries.push({
                            lobbyist_name: parts[0].trim(),
                            firm_name: parts[1]?.trim() || null,
                            registration_number: null,
                            status: 'active',
                            clients: [],
                            legislators_declared: [],
                        });
                    }
                }
            }
        }

        // Deduplicate by name
        const seen = new Set<string>();
        return entries.filter(e => {
            const key = `${e.lobbyist_name}|${e.firm_name || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Parse a cell that may contain a comma-separated list of clients.
     */
    private parseClients(text: string): string[] {
        if (!text) return [];
        return text.split(/[,;]/)
            .map(c => c.trim())
            .filter(c => c.length > 1);
    }

    /**
     * Parse a cell that may contain legislator names.
     */
    private parseLegislatorNames(text: string): string[] {
        if (!text) return [];
        return text.split(/[,;]/)
            .map(n => n.trim())
            .filter(n => n.length > 3);
    }

    /**
     * Ensure the doj_registry_entries table exists.
     * Creates it on first use if missing.
     */
    private async ensureTable() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS doj_registry_entries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    lobbyist_name TEXT NOT NULL,
                    firm_name TEXT,
                    registration_number TEXT,
                    status TEXT DEFAULT 'active',
                    clients JSONB DEFAULT '[]'::jsonb,
                    legislators_declared JSONB DEFAULT '[]'::jsonb,
                    raw_data JSONB,
                    source_url TEXT,
                    last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            
            await this.db.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_doj_entries_lobbyist_firm
                ON doj_registry_entries (lobbyist_name, COALESCE(firm_name, ''))
            `);
        } catch (err: any) {
            this.logger.error(`Error ensuring table: ${err.message}`);
        }
    }
}
