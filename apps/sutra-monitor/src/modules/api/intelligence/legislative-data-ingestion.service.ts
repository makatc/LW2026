import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import axios from 'axios';

/**
 * Task 2.1 — Legislative Data Ingestion Service
 *
 * Fetches historical legislative data (authored measures, votes) from
 * publicly available sources (OSLPR, sutra_measures) and stores raw data
 * in `legislator_historical_data`.
 *
 * STRATEGY:
 * 1. Primary: Query our own DB for measures where the legislator is author/coauthor
 * 2. Secondary: Attempt OSLPR public endpoints (may be unreliable)
 * 3. Fallback: Build profile from interaction history
 *
 * All raw data is stored as JSONB for AI processing in Task 2.2.
 */
@Injectable()
export class LegislativeDataIngestionService {
    private readonly logger = new Logger(LegislativeDataIngestionService.name);

    constructor(private readonly db: DatabaseService) {}

    /**
     * Ingest data for a single legislator.
     * Uses multiple data sources and combines them.
     */
    async ingestForLegislator(legislatorId: string) {
        // Verify legislator exists
        const legRes = await this.db.query(
            'SELECT id, full_name, chamber, party FROM legislators WHERE id = $1',
            [legislatorId],
        );
        if (!legRes.rows[0]) throw new NotFoundException('Legislator not found');

        const legislator = legRes.rows[0];
        this.logger.log(`📥 Ingesting data for ${legislator.full_name}...`);

        // Source 1: Our own measures database
        const authoredMeasures = await this.findAuthoredMeasures(legislator.full_name);
        const coauthoredMeasures = await this.findCoauthoredMeasures(legislator.full_name);

        // Source 2: Voting record from our votes table
        const votingRecord = await this.findVotingRecord(legislatorId);

        // Source 3: Interaction history (positions expressed in meetings)
        const interactionPositions = await this.findInteractionPositions(legislatorId);

        // Source 4: Try OSLPR API (best-effort, may fail)
        let oslprData = null;
        try {
            oslprData = await this.fetchFromOslpr(legislator.full_name, legislator.chamber);
        } catch (err: any) {
            this.logger.warn(`OSLPR fetch failed for ${legislator.full_name}: ${err.message}`);
        }

        const rawData = {
            legislator_name: legislator.full_name,
            chamber: legislator.chamber,
            party: legislator.party,
            ingested_at: new Date().toISOString(),
            sources: {
                local_measures: authoredMeasures.length + coauthoredMeasures.length,
                local_votes: votingRecord.length,
                interaction_positions: interactionPositions.length,
                oslpr: oslprData ? 'success' : 'failed',
            },
        };

        // Upsert into legislator_historical_data
        await this.db.query(
            `INSERT INTO legislator_historical_data
             (legislator_id, authored_measures, coauthored_measures, voting_record, raw_data, source, last_ingested_at)
             VALUES ($1, $2, $3, $4, $5, 'combined', NOW())
             ON CONFLICT (legislator_id)
             DO UPDATE SET
                 authored_measures = $2,
                 coauthored_measures = $3,
                 voting_record = $4,
                 raw_data = $5,
                 source = 'combined',
                 last_ingested_at = NOW(),
                 updated_at = NOW()`,
            [
                legislatorId,
                JSON.stringify(authoredMeasures),
                JSON.stringify(coauthoredMeasures),
                JSON.stringify(votingRecord),
                JSON.stringify({ ...rawData, oslpr: oslprData, interaction_positions: interactionPositions }),
            ],
        );

        this.logger.log(`✅ Ingested ${authoredMeasures.length} authored, ${coauthoredMeasures.length} coauthored, ${votingRecord.length} votes for ${legislator.full_name}`);

        return {
            legislator_id: legislatorId,
            legislator_name: legislator.full_name,
            authored_measures: authoredMeasures.length,
            coauthored_measures: coauthoredMeasures.length,
            voting_records: votingRecord.length,
            interaction_positions: interactionPositions.length,
            oslpr_data: oslprData ? 'available' : 'unavailable',
        };
    }

    /**
     * Batch ingest for all active legislators.
     */
    async ingestAll() {
        const res = await this.db.query(
            'SELECT id FROM legislators WHERE is_active = true ORDER BY full_name',
        );

        const results = [];
        let success = 0;
        let failed = 0;

        for (const row of res.rows) {
            try {
                const result = await this.ingestForLegislator(row.id);
                results.push(result);
                success++;
            } catch (err: any) {
                this.logger.warn(`Failed to ingest for legislator ${row.id}: ${err.message}`);
                failed++;
            }
        }

        return {
            total: res.rows.length,
            success,
            failed,
            results,
        };
    }

    /**
     * Get stored historical data for a legislator.
     */
    async getHistoricalData(legislatorId: string) {
        const res = await this.db.query(
            'SELECT * FROM legislator_historical_data WHERE legislator_id = $1',
            [legislatorId],
        );
        return res.rows[0] || null;
    }

    // ─── Private: Data Sources ────────────────────────────────────────────────

    /**
     * Find measures in our DB where this legislator is listed as author.
     * Matches by name in the `autores` field of sutra_measures.
     */
    private async findAuthoredMeasures(legislatorName: string): Promise<any[]> {
        try {
            const res = await this.db.query(
                `SELECT id, numero, titulo, status, camara, fecha_radicacion,
                        autores, coautores
                 FROM sutra_measures
                 WHERE autores ILIKE $1
                 ORDER BY fecha_radicacion DESC
                 LIMIT 100`,
                [`%${this.normalizeNameForSearch(legislatorName)}%`],
            );
            return res.rows;
        } catch {
            return [];
        }
    }

    /**
     * Find measures where this legislator is coauthor.
     */
    private async findCoauthoredMeasures(legislatorName: string): Promise<any[]> {
        try {
            const res = await this.db.query(
                `SELECT id, numero, titulo, status, camara, fecha_radicacion
                 FROM sutra_measures
                 WHERE coautores ILIKE $1
                 ORDER BY fecha_radicacion DESC
                 LIMIT 100`,
                [`%${this.normalizeNameForSearch(legislatorName)}%`],
            );
            return res.rows;
        } catch {
            return [];
        }
    }

    /**
     * Find voting records from our votes table.
     */
    private async findVotingRecord(legislatorId: string): Promise<any[]> {
        try {
            const res = await this.db.query(
                `SELECT v.id, v.measure_id, v.vote_type, v.vote_date,
                        sm.numero AS measure_number, sm.titulo AS measure_title
                 FROM votes v
                 JOIN sutra_measures sm ON sm.id = v.measure_id
                 WHERE v.legislator_id = $1
                 ORDER BY v.vote_date DESC
                 LIMIT 200`,
                [legislatorId],
            );
            return res.rows;
        } catch {
            return [];
        }
    }

    /**
     * Find positions expressed during interactions.
     */
    private async findInteractionPositions(legislatorId: string): Promise<any[]> {
        try {
            const res = await this.db.query(
                `SELECT im.position_expressed, im.measure_reference, im.measure_id,
                        i.interaction_date, i.contact_type, i.notes,
                        sm.numero AS measure_number, sm.titulo AS measure_title
                 FROM interaction_measures im
                 JOIN interactions i ON i.id = im.interaction_id
                 LEFT JOIN sutra_measures sm ON sm.id = im.measure_id
                 WHERE i.legislator_id = $1 AND i.is_deleted = false
                   AND im.position_expressed IS NOT NULL
                 ORDER BY i.interaction_date DESC
                 LIMIT 100`,
                [legislatorId],
            );
            return res.rows;
        } catch {
            return [];
        }
    }

    /**
     * Attempt to fetch data from OSLPR public endpoints.
     *
     * OSLPR sites:
     * - https://sutra.oslpr.org/osl/ (search by author name)
     * - Senate and House official sites
     *
     * NOTE: This is best-effort. OSLPR endpoints are not stable APIs
     * and may change or be unavailable. We use our own DB as primary source.
     */
    private async fetchFromOslpr(legislatorName: string, chamber: string): Promise<any> {
        const searchName = this.normalizeNameForSearch(legislatorName);

        try {
            // Try OSLPR SUTRA search API
            const sutraUrl = `https://sutra.oslpr.org/osl/SUTRA/api/legislacion?autor=${encodeURIComponent(searchName)}&limit=50`;
            const response = await axios.get(sutraUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 LegalWatch/2.0',
                    'Accept': 'application/json',
                },
                // Don't throw on non-200 to handle gracefully
                validateStatus: (status) => status < 500,
            });

            if (response.status === 200 && response.data) {
                return {
                    source: 'oslpr_sutra',
                    measures: Array.isArray(response.data) ? response.data : response.data?.results || [],
                    fetched_at: new Date().toISOString(),
                };
            }

            // If SUTRA fails, try searching the legislative website
            const altUrl = chamber === 'upper'
                ? `https://senado.pr.gov/Pages/Busqueda.aspx?k=${encodeURIComponent(searchName)}`
                : `https://www.tucamarapr.org/dnncamara/web/SearchBills.aspx?term=${encodeURIComponent(searchName)}`;

            // These are HTML pages, so we'd need to scrape them.
            // For now, return null and rely on our local DB.
            this.logger.debug(`OSLPR SUTRA returned ${response.status}, would try ${altUrl} but deferring HTML scraping`);
            return null;
        } catch (err: any) {
            this.logger.debug(`OSLPR fetch attempt failed: ${err.message}`);
            return null;
        }
    }

    /**
     * Normalize a name for search: extract last names.
     * "José Luis Dalmau Santiago" → "Dalmau Santiago"
     */
    private normalizeNameForSearch(fullName: string): string {
        const parts = fullName.trim().split(/\s+/);
        // Heuristic: last 2 parts are surnames in Hispanic naming
        if (parts.length >= 3) {
            return parts.slice(-2).join(' ');
        }
        return fullName;
    }
}
