import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EXECUTIVE_RADAR_CONSTANTS } from './executive-radar.constants';

@Injectable()
export class ExecutiveRadarService {
  private readonly logger = new Logger(ExecutiveRadarService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Public queries ───────────────────────────────────────────────────────────

  async getOrders(filters: {
    sector?: string;
    year?: number;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const { sector, year, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (sector) {
      // sectors_affected is stored as JSON array
      values.push(sector);
      conditions.push(`sectors_affected @> $${values.length}::jsonb`);
    }

    if (year) {
      values.push(year);
      conditions.push(`year = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countRes = await this.db.query(
      `SELECT COUNT(*) FROM executive_orders ${where}`,
      values
    ).catch(() => ({ rows: [{ count: '0' }] }));
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    // Data query
    values.push(limit, offset);
    const dataRes = await this.db.query(
      `SELECT id, order_number, year, title, signed_date,
              source_url AS pdf_url, estado_url, fortaleza_url,
              ai_summary AS summary, agencies_involved, sectors_affected,
              urgency_assessment, scraped_at, created_at
       FROM executive_orders
       ${where}
       ORDER BY signed_date DESC NULLS LAST, scraped_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    ).catch(() => ({ rows: [] }));

    return { data: dataRes.rows, total };
  }

  async getOrderById(id: string): Promise<any> {
    const res = await this.db.query(
      `SELECT id, order_number, year, title, signed_date,
              source_url AS pdf_url, estado_url, fortaleza_url,
              raw_content AS full_text, ai_summary AS summary,
              agencies_involved, sectors_affected, referenced_legislation,
              urgency_assessment, scraped_at, created_at, updated_at
       FROM executive_orders
       WHERE id = $1`,
      [id]
    ).catch(() => ({ rows: [] }));

    if (res.rows.length === 0) {
      throw new NotFoundException(`Executive order ${id} not found`);
    }

    return res.rows[0];
  }

  // ─── User alerts ─────────────────────────────────────────────────────────────

  async getUserAlerts(userId: string): Promise<any[]> {
    const res = await this.db.query(
      `SELECT
         a.id AS alert_id,
         a.executive_order_id,
         a.bill_id,
         a.created_at AS alert_created_at,
         eo.order_number,
         eo.title AS order_title,
         eo.signed_date,
         eo.summary AS order_summary,
         eo.urgency_assessment,
         eo.sectors_affected,
         eo.pdf_url,
         sm.numero AS bill_number,
         sm.titulo AS bill_title,
         sm.status AS bill_status
       FROM executive_order_portfolio_alerts a
       JOIN executive_orders eo ON eo.id = a.executive_order_id
       LEFT JOIN sutra_measures sm ON sm.id = a.bill_id
       WHERE a.user_id = $1
         AND a.dismissed = false
       ORDER BY a.created_at DESC`,
      [userId]
    ).catch(() => ({ rows: [] }));

    return res.rows;
  }

  async dismissAlert(alertId: string, userId: string): Promise<void> {
    const res = await this.db.query(
      // dismissed_at added via migration in database-migration.service.ts
      `UPDATE executive_order_portfolio_alerts
       SET dismissed = true
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [alertId, userId]
    ).catch(() => ({ rows: [] }));

    if (res.rows.length === 0) {
      throw new NotFoundException(`Alert ${alertId} not found or not owned by user`);
    }

    this.logger.debug(`Alert ${alertId} dismissed by user ${userId}`);
  }
}
