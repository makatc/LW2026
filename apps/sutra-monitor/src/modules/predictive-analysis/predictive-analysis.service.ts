import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ViabilityScoreCalculator } from './viability-score-calculator';

// Puerto Rico legislative session calendar constants
const SESSION_END_DATE = new Date('2026-06-30'); // Typical end of regular session
const ELECTORAL_YEARS = [2024, 2028, 2032]; // PR gubernatorial election years

@Injectable()
export class PredictiveAnalysisService {
  private readonly logger = new Logger(PredictiveAnalysisService.name);
  private readonly calculator = new ViabilityScoreCalculator();

  constructor(private readonly db: DatabaseService) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async getViabilityScore(billId: string): Promise<any> {
    // Check cache first (< 24h from last_calculated_at)
    const cached = await this.db.query(
      `SELECT * FROM viability_scores WHERE bill_id = $1
       AND last_calculated_at >= NOW() - INTERVAL '24 hours'
       ORDER BY last_calculated_at DESC LIMIT 1`,
      [billId]
    ).catch(() => ({ rows: [] }));

    if (cached.rows.length > 0) {
      return { ...cached.rows[0], cached: true };
    }

    return this.computeAndSave(billId);
  }

  async recalculate(billId: string): Promise<any> {
    return this.computeAndSave(billId);
  }

  async getPortfolioOverview(userId: string): Promise<any[]> {
    // Get all bills tracked by user from watchlist
    const watchlist = await this.db.query(
      `SELECT w.measure_id, sm.numero, sm.titulo, sm.status, sm.bill_type,
              sm.last_seen_at
       FROM watchlist_items w
       JOIN sutra_measures sm ON sm.id = w.measure_id
       WHERE w.user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    if (watchlist.rows.length === 0) return [];

    const results: any[] = [];

    for (const item of watchlist.rows) {
      try {
        const score = await this.getViabilityScore(item.measure_id);
        results.push({
          bill_id: item.measure_id,
          numero: item.numero,
          titulo: item.titulo,
          status: item.status,
          bill_type: item.bill_type,
          last_seen_at: item.last_seen_at,
          viability_score: score.total_score,
          confidence_level: score.confidence_level,
          score_breakdown: score.score_breakdown,
          last_calculated_at: score.last_calculated_at,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Could not compute score for bill ${item.measure_id}: ${msg}`);
        results.push({
          bill_id: item.measure_id,
          numero: item.numero,
          titulo: item.titulo,
          status: item.status,
          bill_type: item.bill_type,
          last_seen_at: item.last_seen_at,
          viability_score: null,
          confidence_level: 'low',
          error: 'Score unavailable',
        });
      }
    }

    return results;
  }

  // ─── Core computation ────────────────────────────────────────────────────────

  private async computeAndSave(billId: string): Promise<any> {
    // Fetch bill
    const billRes = await this.db.query(
      `SELECT * FROM sutra_measures WHERE id = $1`,
      [billId]
    ).catch(() => ({ rows: [] }));

    if (billRes.rows.length === 0) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }
    const bill = billRes.rows[0];

    // Gather all supporting data in parallel
    const [legislators, committees, fiscalNotes, fombActions] = await Promise.all([
      this.db.query(`SELECT * FROM legislators WHERE is_active = true`).catch(() => ({ rows: [] })),
      this.db.query(`SELECT * FROM committees`).catch(() => ({ rows: [] })),
      this.db.query(
        `SELECT * FROM fiscal_notes WHERE bill_id = $1 ORDER BY published_at DESC NULLS LAST`,
        [billId]
      ).catch(() => ({ rows: [] })),
      this.db.query(
        `SELECT * FROM fomb_actions WHERE bill_id = $1 ORDER BY fomb_letter_date DESC NULLS LAST`,
        [billId]
      ).catch(() => ({ rows: [] })),
    ]);

    // Fetch similar bills by bill_type for thematic rate
    const historicalBills = await this.db.query(
      `SELECT id, numero, status, commission, bill_type
       FROM sutra_measures
       WHERE bill_type = $1
         AND id != $2
         AND status IS NOT NULL
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT 100`,
      [bill.bill_type || 'general', billId]
    ).catch(() => ({ rows: [] }));

    const sessionDaysRemaining = this.calcSessionDaysRemaining();
    const isElectoralYear = ELECTORAL_YEARS.includes(new Date().getFullYear());

    const result = this.calculator.calculate({
      bill,
      legislators: legislators.rows,
      committees: committees.rows,
      fiscalNotes: fiscalNotes.rows,
      fombActions: fombActions.rows,
      historicalBills: historicalBills.rows,
      sessionDaysRemaining,
      isElectoralYear,
    });

    // Persist result
    await this.db.query(
      `INSERT INTO viability_scores
         (bill_id, total_score, score_breakdown, confidence_level,
          factors_with_data, total_factors, last_calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (bill_id) DO UPDATE SET
         total_score = EXCLUDED.total_score,
         score_breakdown = EXCLUDED.score_breakdown,
         confidence_level = EXCLUDED.confidence_level,
         factors_with_data = EXCLUDED.factors_with_data,
         total_factors = EXCLUDED.total_factors,
         last_calculated_at = NOW()`,
      [
        billId,
        result.total_score,
        JSON.stringify(result.score_breakdown),
        result.confidence_level,
        result.factors_with_data,
        result.total_factors,
      ]
    ).catch((err: unknown) => {
      // Table may not exist yet — log and continue
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not persist viability score for ${billId}: ${msg}`);
    });

    return {
      bill_id: billId,
      numero: bill.numero,
      titulo: bill.titulo,
      ...result,
      last_calculated_at: new Date(),
      cached: false,
    };
  }

  private calcSessionDaysRemaining(): number {
    const now = new Date();
    const diff = SESSION_END_DATE.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}
