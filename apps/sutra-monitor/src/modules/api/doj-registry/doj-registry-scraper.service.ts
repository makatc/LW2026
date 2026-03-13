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
 * Updated for the new portal (2026):
 * https://registrodecabilderos.pr.gov/Lobbyist
 */
@Injectable()
export class DojRegistryScraperService {
    private readonly logger = new Logger(DojRegistryScraperService.name);

    private readonly baseUrl = 'https://registrodecabilderos.pr.gov/Lobbyist';
    private readonly detailsUrl = 'https://registrodecabilderos.pr.gov/Lobbyist/Details';

    constructor(private readonly db: DatabaseService) {}

    /**
     * Main scrape method: fetches and parses the DOJ registry.
     */
    async scrapeRegistry() {
        this.logger.log('🕷️ Starting DOJ Registry scrape (New Portal)...');

        // Ensure the storage table exists
        await this.ensureTable();

        try {
            // 1. Initial GET to obtain cookies and Antiforgery Token
            this.logger.debug(`Fetching initial tokens from ${this.baseUrl}`);
            const initialResponse = await axios.get(this.baseUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 LegalWatch/2.0',
                }
            });

            const cookies = initialResponse.headers['set-cookie'];
            const $initial = cheerio.load(initialResponse.data);
            const token = $initial('input[name="__RequestVerificationToken"]').val() as string;

            if (!token || !cookies) {
                throw new Error('Could not obtain Antiforgery Token or cookies from DOJ site');
            }

            this.logger.debug('✅ Tokens obtained. Accepting terms...');

            // 2. POST to /Lobbyist/Details to "accept" terms and get the data
            const params = new URLSearchParams();
            params.append('__RequestVerificationToken', token);

            const postResponse = await axios.post(
                this.detailsUrl,
                params.toString(),
                {
                    timeout: 30000,
                    headers: {
                        'Cookie': cookies.join('; '),
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': this.baseUrl,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 LegalWatch/2.0',
                    }
                }
            );

            if (postResponse.status !== 200 || !postResponse.data) {
                throw new Error(`Failed to fetch registry data. Status: ${postResponse.status}`);
            }

            // 3. Parse the HTML
            const entries = this.parseRegistryPage(postResponse.data, this.detailsUrl);
            this.logger.log(`📋 Parsed ${entries.length} registry entries`);

            // 4. Store/update entries in DB
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
                            this.detailsUrl,
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
                source_url: this.detailsUrl,
                total_entries: entries.length,
                inserted,
                updated,
                scraped_at: new Date().toISOString(),
            };

            this.logger.log(`✅ DOJ scrape complete: ${inserted} new, ${updated} updated`);
            return scrapeResult;

        } catch (err: any) {
            this.logger.error(`❌ DOJ Scrape failed: ${err.message}`);
            return {
                status: 'failed',
                message: err.message,
                url: this.detailsUrl,
            };
        }
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
     */
    private parseRegistryPage(html: string, sourceUrl: string): any[] {
        const $ = cheerio.load(html);
        const entries: any[] = [];

        // In the new portal, data is in a table with class 'table-striped' (typically)
        // We'll look for any table with rows.
        $('table tr').each((i, row) => {
            if (i === 0) return; // Skip header

            const cells = $(row).find('td');
            if (cells.length >= 3) {
                const name = $(cells[0]).text().trim();
                const regNum = $(cells[1]).text().trim();
                const clientsText = $(cells[2]).text().trim();
                const staffText = $(cells[3]).text().trim();

                if (name && regNum) {
                    entries.push({
                        lobbyist_name: name,
                        firm_name: null, // New portal doesn't explicitly separate firm from individual in columns
                        registration_number: regNum,
                        status: 'active',
                        clients: this.parseList(clientsText),
                        legislators_declared: [], // New portal doesn't show this in the main table
                        personal_autorizado: this.parseList(staffText),
                    });
                }
            }
        });

        // Deduplicate by name + registration number
        const seen = new Set<string>();
        return entries.filter(e => {
            const key = `${e.lobbyist_name}|${e.registration_number}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Parse a semicolon-separated list.
     */
    private parseList(text: string): string[] {
        if (!text) return [];
        return text.split(/[;]/)
            .map(c => c.trim())
            .filter(c => c.length > 1);
    }

    /**
     * Ensure the doj_registry_entries table exists.
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
