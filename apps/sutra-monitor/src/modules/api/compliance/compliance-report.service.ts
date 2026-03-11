import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Task 5.1 — Compliance Report Service
 *
 * Aggregates interaction data for DOJ reporting under Ley 118-2003
 * (Puerto Rico Lobbying Disclosure Act).
 *
 * Report structure follows DOJ semestral format:
 * - Reporting period (semester)
 * - Organization/lobbyist info
 * - List of legislators contacted
 * - For each: date, type, measures discussed, positions
 * - Summary statistics
 */
@Injectable()
export class ComplianceReportService {
    private readonly logger = new Logger(ComplianceReportService.name);

    constructor(private readonly db: DatabaseService) {}

    /**
     * Generate full compliance report data for a semester.
     */
    async generateReport(year: number, semester: 1 | 2, organizationId?: string) {
        const { dateFrom, dateTo } = this.getSemesterDates(year, semester);

        this.logger.log(`📋 Generating compliance report for ${year} S${semester} (${dateFrom} to ${dateTo})`);

        // 1. Get all interactions in the period
        const interactionsRes = await this.db.query(
            `SELECT i.id, i.legislator_id, i.contact_type, i.interaction_date,
                    i.notes, i.next_step_description, i.created_by,
                    l.full_name AS legislator_name,
                    l.chamber AS legislator_chamber,
                    l.party AS legislator_party,
                    l.district AS legislator_district,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'measure_id', im.measure_id,
                            'measure_reference', im.measure_reference,
                            'position_expressed', im.position_expressed,
                            'measure_number', sm.numero,
                            'measure_title', sm.titulo
                        )) FROM interaction_measures im
                          LEFT JOIN sutra_measures sm ON sm.id = im.measure_id
                          WHERE im.interaction_id = i.id), '[]'
                    ) AS measures,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'staff_name', COALESCE(ls.name, ip.custom_name, 'Legislador directo'),
                            'staff_title', ls.title
                        )) FROM interaction_participants ip
                          LEFT JOIN legislator_staff ls ON ls.id = ip.staff_id
                          WHERE ip.interaction_id = i.id), '[]'
                    ) AS participants
             FROM interactions i
             JOIN legislators l ON l.id = i.legislator_id
             WHERE i.is_deleted = false
               AND i.interaction_date >= $1
               AND i.interaction_date < $2
               ${organizationId ? 'AND i.organization_id = $3' : ''}
             ORDER BY i.interaction_date ASC`,
            organizationId ? [dateFrom, dateTo, organizationId] : [dateFrom, dateTo],
        );

        const interactions = interactionsRes.rows;

        // 2. Group by legislator
        const byLegislator = new Map<string, any>();
        for (const inter of interactions) {
            if (!byLegislator.has(inter.legislator_id)) {
                byLegislator.set(inter.legislator_id, {
                    legislator_id: inter.legislator_id,
                    legislator_name: inter.legislator_name,
                    legislator_chamber: inter.legislator_chamber,
                    legislator_party: inter.legislator_party,
                    legislator_district: inter.legislator_district,
                    interactions: [],
                    total_contacts: 0,
                    contact_types: {} as Record<string, number>,
                    measures_discussed: new Set<string>(),
                });
            }
            const entry = byLegislator.get(inter.legislator_id)!;
            entry.interactions.push({
                date: inter.interaction_date,
                contact_type: inter.contact_type,
                notes: inter.notes,
                measures: inter.measures,
                participants: inter.participants,
            });
            entry.total_contacts++;
            entry.contact_types[inter.contact_type] = (entry.contact_types[inter.contact_type] || 0) + 1;
            for (const m of inter.measures) {
                if (m.measure_number || m.measure_reference) {
                    entry.measures_discussed.add(m.measure_number || m.measure_reference);
                }
            }
        }

        // Convert Sets to arrays for JSON serialization
        const legislatorReports = Array.from(byLegislator.values()).map(entry => ({
            ...entry,
            measures_discussed: Array.from(entry.measures_discussed),
        }));

        // 3. Compile all unique measures discussed
        const allMeasures = new Set<string>();
        for (const inter of interactions) {
            for (const m of inter.measures) {
                if (m.measure_number || m.measure_reference) {
                    allMeasures.add(JSON.stringify({
                        number: m.measure_number || m.measure_reference,
                        title: m.measure_title || '',
                    }));
                }
            }
        }

        // 4. Summary stats
        const contactTypeSummary: Record<string, number> = {};
        for (const inter of interactions) {
            contactTypeSummary[inter.contact_type] = (contactTypeSummary[inter.contact_type] || 0) + 1;
        }

        return {
            report_metadata: {
                year,
                semester,
                period_label: semester === 1
                    ? `1 de enero al 30 de junio de ${year}`
                    : `1 de julio al 31 de diciembre de ${year}`,
                date_from: dateFrom,
                date_to: dateTo,
                generated_at: new Date().toISOString(),
                law_reference: 'Ley 118-2003 — Ley para la Reglamentación del Cabildeo en Puerto Rico',
            },
            summary: {
                total_interactions: interactions.length,
                total_legislators_contacted: byLegislator.size,
                total_unique_measures: allMeasures.size,
                by_contact_type: contactTypeSummary,
                by_chamber: {
                    senado: legislatorReports.filter(l => l.legislator_chamber === 'upper').length,
                    camara: legislatorReports.filter(l => l.legislator_chamber === 'lower').length,
                },
            },
            legislators: legislatorReports,
            measures_discussed: Array.from(allMeasures).map(s => JSON.parse(s)),
        };
    }

    /**
     * Quick summary without full interaction details.
     */
    async getSummary(year: number, semester: 1 | 2) {
        const { dateFrom, dateTo } = this.getSemesterDates(year, semester);

        const res = await this.db.query(
            `SELECT
                COUNT(*) AS total_interactions,
                COUNT(DISTINCT i.legislator_id) AS legislators_contacted,
                COUNT(DISTINCT im.measure_id) FILTER (WHERE im.measure_id IS NOT NULL) AS measures_discussed,
                json_object_agg(
                    COALESCE(i.contact_type::text, 'otro'),
                    type_count
                ) AS by_contact_type
             FROM interactions i
             LEFT JOIN interaction_measures im ON im.interaction_id = i.id
             LEFT JOIN LATERAL (
                 SELECT i2.contact_type, COUNT(*) AS type_count
                 FROM interactions i2
                 WHERE i2.is_deleted = false
                   AND i2.interaction_date >= $1
                   AND i2.interaction_date < $2
                 GROUP BY i2.contact_type
             ) ct ON ct.contact_type = i.contact_type
             WHERE i.is_deleted = false
               AND i.interaction_date >= $1
               AND i.interaction_date < $2`,
            [dateFrom, dateTo],
        );

        const row = res.rows[0] || {};

        // Simpler query for by_contact_type
        const typeRes = await this.db.query(
            `SELECT contact_type::text, COUNT(*) AS count
             FROM interactions
             WHERE is_deleted = false
               AND interaction_date >= $1
               AND interaction_date < $2
             GROUP BY contact_type`,
            [dateFrom, dateTo],
        );

        const byType: Record<string, number> = {};
        for (const r of typeRes.rows) {
            byType[r.contact_type] = parseInt(r.count, 10);
        }

        return {
            year,
            semester,
            period_label: semester === 1
                ? `Enero - Junio ${year}`
                : `Julio - Diciembre ${year}`,
            total_interactions: parseInt(row.total_interactions || '0', 10),
            legislators_contacted: parseInt(row.legislators_contacted || '0', 10),
            measures_discussed: parseInt(row.measures_discussed || '0', 10),
            by_contact_type: byType,
        };
    }

    private getSemesterDates(year: number, semester: 1 | 2) {
        return {
            dateFrom: semester === 1 ? `${year}-01-01` : `${year}-07-01`,
            dateTo: semester === 1 ? `${year}-07-01` : `${year + 1}-01-01`,
        };
    }
}
