import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FiscalIntelligenceService {
  private readonly logger = new Logger(FiscalIntelligenceService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Fiscal Notes ──────────────────────────────────────────────────────────

  async getFiscalNotesByBill(billId: string) {
    // Verify bill exists
    const bill = await this.db.query(
      `SELECT id FROM sutra_measures WHERE id = $1`,
      [billId]
    );
    if (bill.rows.length === 0) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    const res = await this.db.query(
      `SELECT id, bill_id, bill_number, source_agency, source_url, document_url,
              title, summary, fiscal_impact_amount, fiscal_impact_type,
              published_at, scraped_at, created_at
       FROM fiscal_notes
       WHERE bill_id = $1
       ORDER BY published_at DESC NULLS LAST, created_at DESC`,
      [billId]
    );
    return res.rows;
  }

  async getFiscalNotesByAgency() {
    const res = await this.db.query(
      `SELECT source_agency,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE fiscal_impact_type = 'cost') AS cost_count,
              COUNT(*) FILTER (WHERE fiscal_impact_type = 'saving') AS saving_count,
              COUNT(*) FILTER (WHERE fiscal_impact_type = 'neutral') AS neutral_count,
              COUNT(*) FILTER (WHERE fiscal_impact_type = 'undetermined') AS undetermined_count,
              MAX(scraped_at) AS last_scraped
       FROM fiscal_notes
       GROUP BY source_agency
       ORDER BY total DESC`
    );
    return res.rows;
  }

  async getAllFiscalNotes(params: { agency?: string; limit?: number; offset?: number }) {
    const { agency, limit = 20, offset = 0 } = params;
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (agency) {
      values.push(agency);
      conditions.push(`source_agency = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const res = await this.db.query(
      `SELECT fn.id, fn.bill_id, fn.bill_number, fn.source_agency,
              fn.source_url, fn.document_url, fn.title, fn.summary,
              fn.fiscal_impact_amount, fn.fiscal_impact_type,
              fn.published_at, fn.scraped_at,
              sm.titulo AS bill_title
       FROM fiscal_notes fn
       LEFT JOIN sutra_measures sm ON sm.id = fn.bill_id
       ${where}
       ORDER BY fn.scraped_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countRes = await this.db.query(
      `SELECT COUNT(*) FROM fiscal_notes ${where}`,
      values.slice(0, -2)
    );

    return {
      data: res.rows,
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
    };
  }

  // ─── FOMB Actions ──────────────────────────────────────────────────────────

  async getFombActionsByBill(billId: string) {
    const bill = await this.db.query(
      `SELECT id FROM sutra_measures WHERE id = $1`,
      [billId]
    );
    if (bill.rows.length === 0) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    const res = await this.db.query(
      `SELECT id, bill_id, law_number, bill_number, action_type,
              implementation_status, fomb_letter_date, fomb_letter_url,
              summary, promesa_basis, fiscal_plan_reference, scraped_at, created_at
       FROM fomb_actions
       WHERE bill_id = $1
       ORDER BY fomb_letter_date DESC NULLS LAST, created_at DESC`,
      [billId]
    );
    return res.rows;
  }

  async getRecentFombActions(params: { status?: string; limit?: number; offset?: number }) {
    const { status, limit = 20, offset = 0 } = params;
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status) {
      values.push(status);
      conditions.push(`fa.implementation_status = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const res = await this.db.query(
      `SELECT fa.id, fa.bill_id, fa.law_number, fa.bill_number, fa.action_type,
              fa.implementation_status, fa.fomb_letter_date, fa.fomb_letter_url,
              fa.summary, fa.promesa_basis, fa.fiscal_plan_reference, fa.scraped_at,
              sm.titulo AS bill_title
       FROM fomb_actions fa
       LEFT JOIN sutra_measures sm ON sm.id = fa.bill_id
       ${where}
       ORDER BY fa.fomb_letter_date DESC NULLS LAST, fa.scraped_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countRes = await this.db.query(
      `SELECT COUNT(*) FROM fomb_actions fa ${where}`,
      values.slice(0, -2)
    );

    return {
      data: res.rows,
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
    };
  }

  // ─── Dashboard: Portfolio Summary ──────────────────────────────────────────

  async getPortfolioSummary(userId: string) {
    // Get watchlist items for this user
    const watchlist = await this.db.query(
      `SELECT w.measure_id, sm.numero, sm.titulo, sm.status, sm.bill_type,
              sm.last_seen_at
       FROM watchlist_items w
       JOIN sutra_measures sm ON sm.id = w.measure_id
       WHERE w.user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    // Group by status
    const byStatus: Record<string, unknown[]> = {};
    for (const row of watchlist.rows) {
      const s = row.status || 'Sin estado';
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(row);
    }

    return {
      total: watchlist.rows.length,
      byStatus,
      measures: watchlist.rows,
    };
  }

  // ─── Dashboard: FOMB Risk ─────────────────────────────────────────────────

  async getFombRisk(userId: string) {
    // Get user's watchlist measures and their sectors (bill_type as proxy for sector)
    const watchlist = await this.db.query(
      `SELECT sm.bill_type, sm.numero, sm.titulo
       FROM watchlist_items w
       JOIN sutra_measures sm ON sm.id = w.measure_id
       WHERE w.user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    if (watchlist.rows.length === 0) {
      return { sectors: [], overall_risk: 0 };
    }

    // Get FOMB actions in last 12 months grouped by sector
    const fombStats = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE implementation_status = 'blocked') AS blocked_count,
         COUNT(*) AS total_count,
         DATE_TRUNC('month', fomb_letter_date) AS month
       FROM fomb_actions
       WHERE fomb_letter_date >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', fomb_letter_date)
       ORDER BY month DESC`
    ).catch(() => ({ rows: [] }));

    const blocked12m = fombStats.rows.reduce((sum: number, r: { blocked_count: string }) => sum + parseInt(r.blocked_count || '0', 10), 0);
    const total12m = fombStats.rows.reduce((sum: number, r: { total_count: string }) => sum + parseInt(r.total_count || '0', 10), 0);

    const overallScore = total12m > 0 ? Math.round((blocked12m / total12m) * 100) : 0;

    // Group user's watchlist by bill_type (sector proxy)
    const sectorMap: Record<string, { count: number; measures: unknown[] }> = {};
    for (const row of watchlist.rows) {
      const sector = row.bill_type || 'General';
      if (!sectorMap[sector]) sectorMap[sector] = { count: 0, measures: [] };
      sectorMap[sector].count++;
      sectorMap[sector].measures.push({ numero: row.numero, titulo: row.titulo });
    }

    const sectors = Object.entries(sectorMap).map(([sector, data]) => ({
      sector,
      measure_count: data.count,
      measures: data.measures,
      fomb_risk_score: overallScore, // Apply global score as baseline
      risk_level: overallScore <= 25 ? 'low' : overallScore <= 60 ? 'moderate' : 'high',
    }));

    // Get recent blocking actions for context
    const recentBlocked = await this.db.query(
      `SELECT law_number, bill_number, summary, fomb_letter_date
       FROM fomb_actions
       WHERE implementation_status = 'blocked'
         AND fomb_letter_date >= NOW() - INTERVAL '12 months'
       ORDER BY fomb_letter_date DESC
       LIMIT 5`
    ).catch(() => ({ rows: [] }));

    return {
      sectors,
      overall_risk: overallScore,
      risk_level: overallScore <= 25 ? 'low' : overallScore <= 60 ? 'moderate' : 'high',
      blocked_last_12m: blocked12m,
      total_actions_12m: total12m,
      recent_blocked: recentBlocked.rows,
    };
  }

  // ─── Dashboard: Calendar ──────────────────────────────────────────────────

  async getCalendar() {
    // TODO: integrar con scraper de agenda legislativa
    return {
      events: [],
      note: 'Calendar data not yet available — scraper for legislative agenda pending.',
    };
  }

  // ─── Dashboard: Briefing ──────────────────────────────────────────────────

  async getBriefing(userId: string, forceRefresh = false) {
    const today = new Date().toISOString().split('T')[0];

    if (!forceRefresh) {
      const cached = await this.db.query(
        `SELECT content, generated_at FROM dashboard_briefings WHERE user_id = $1 AND briefing_date = $2`,
        [userId, today]
      );
      if (cached.rows.length > 0) {
        return { ...cached.rows[0], cached: true, date: today };
      }
    }

    // Generate fresh briefing
    const briefing = await this.generateBriefingContent(userId);

    await this.db.query(
      `INSERT INTO dashboard_briefings (user_id, briefing_date, content, generated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, briefing_date) DO UPDATE
       SET content = EXCLUDED.content, generated_at = NOW()`,
      [userId, today, JSON.stringify(briefing)]
    );

    return { content: briefing, cached: false, date: today, generated_at: new Date() };
  }

  private async generateBriefingContent(userId: string) {
    const today = new Date().toISOString().split('T')[0];

    // Critical: new FOMB blocking actions (last 24h)
    const criticalFomb = await this.db.query(
      `SELECT fa.law_number, fa.bill_number, fa.summary, fa.fomb_letter_date,
              fa.fomb_letter_url, sm.titulo AS bill_title
       FROM fomb_actions fa
       LEFT JOIN sutra_measures sm ON sm.id = fa.bill_id
       WHERE fa.implementation_status = 'blocked'
         AND fa.scraped_at >= NOW() - INTERVAL '24 hours'
       ORDER BY fa.fomb_letter_date DESC
       LIMIT 5`
    ).catch(() => ({ rows: [] }));

    // Urgent: new fiscal notes on user's watchlist (last 48h)
    const urgentNotes = await this.db.query(
      `SELECT fn.bill_number, fn.source_agency, fn.title, fn.fiscal_impact_type,
              fn.source_url, sm.titulo AS bill_title
       FROM fiscal_notes fn
       JOIN sutra_measures sm ON sm.id = fn.bill_id
       JOIN watchlist_items w ON w.measure_id = fn.bill_id
       WHERE w.user_id = $1
         AND fn.scraped_at >= NOW() - INTERVAL '48 hours'
       ORDER BY fn.scraped_at DESC
       LIMIT 10`,
      [userId]
    ).catch(() => ({ rows: [] }));

    // Updates: status changes on watchlist (last 7d)
    const updates = await this.db.query(
      `SELECT sm.numero, sm.titulo, sm.status, sm.last_seen_at
       FROM watchlist_items w
       JOIN sutra_measures sm ON sm.id = w.measure_id
       WHERE w.user_id = $1
         AND sm.last_seen_at >= NOW() - INTERVAL '7 days'
       ORDER BY sm.last_seen_at DESC
       LIMIT 10`,
      [userId]
    ).catch(() => ({ rows: [] }));

    // Recent FOMB feed (last 5 actions)
    const fombFeed = await this.db.query(
      `SELECT id, law_number, bill_number, action_type, implementation_status,
              fomb_letter_date, fomb_letter_url, summary
       FROM fomb_actions
       ORDER BY fomb_letter_date DESC NULLS LAST, scraped_at DESC
       LIMIT 5`
    ).catch(() => ({ rows: [] }));

    const critical = criticalFomb.rows.map((r: {
      law_number: string; bill_number: string; bill_title: string;
      summary: string; fomb_letter_url: string;
    }) => ({
      bill_number: r.law_number || r.bill_number || 'N/A',
      title: r.bill_title || 'Sin título',
      event_type: 'fomb_blocked' as const,
      summary: r.summary || 'Acción de bloqueo FOMB detectada.',
      urgency: 'critical' as const,
      source_url: r.fomb_letter_url,
    }));

    const urgent = urgentNotes.rows.map((r: {
      bill_number: string; bill_title: string; source_agency: string;
      title: string; fiscal_impact_type: string; source_url: string;
    }) => ({
      bill_number: r.bill_number || 'N/A',
      title: r.bill_title || r.title || 'Sin título',
      event_type: 'fiscal_note_new' as const,
      summary: `Nuevo memorial de ${r.source_agency}: "${r.title}". Impacto fiscal: ${r.fiscal_impact_type || 'por determinar'}.`,
      urgency: 'urgent' as const,
      source_url: r.source_url,
    }));

    const updateItems = updates.rows.map((r: {
      numero: string; titulo: string; status: string; last_seen_at: string;
    }) => ({
      bill_number: r.numero || 'N/A',
      title: r.titulo || 'Sin título',
      event_type: 'status_change' as const,
      summary: `Estado actualizado: ${r.status || 'Sin estado'}. Última actividad: ${r.last_seen_at ? new Date(r.last_seen_at).toLocaleDateString('es-PR') : 'N/A'}.`,
      urgency: 'update' as const,
    }));

    return {
      date: today,
      critical,
      urgent,
      updates: updateItems,
      fomb_feed: fombFeed.rows,
    };
  }
}
