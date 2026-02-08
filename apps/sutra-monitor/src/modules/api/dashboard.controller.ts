import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { pool } from '@lwbeta/db';
import { ConfigService } from '../config/config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserID } from '../auth/decorators';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly configService: ConfigService) { }

  @Get('summary')
  async getSummary(@UserID() userId: string) {
    // 1. Keyword Hits Count
    const keywords = await pool.query(`
            SELECT COUNT(*) 
            FROM discovery_hits dh
            JOIN monitor_configs mc ON dh.config_id = mc.id
            WHERE dh.hit_type = 'KEYWORD' AND mc.user_id = $1
        `, [userId]);

    // 2. Topic Hits Count
    const topics = await pool.query(`
            SELECT COUNT(*) 
            FROM discovery_hits dh
            JOIN monitor_configs mc ON dh.config_id = mc.id
            WHERE dh.hit_type = 'TOPIC' AND mc.user_id = $1
        `, [userId]);

    // 3. Commission Hits Count
    const commissions = await pool.query(`
            SELECT COUNT(*) 
            FROM discovery_hits dh
            JOIN monitor_configs mc ON dh.config_id = mc.id
            WHERE dh.hit_type = 'COMMISSION' AND mc.user_id = $1
        `, [userId]);

    // 4. Watchlist Updates Count
    const updates = await pool.query(`
            SELECT COUNT(*) 
            FROM watchlist_items wi
            JOIN monitor_configs mc ON wi.config_id = mc.id
            WHERE mc.user_id = $1 AND wi.enabled = true
        `, [userId]);

    return {
      hits_keyword: parseInt(keywords.rows[0].count),
      hits_topics: parseInt(topics.rows[0].count),
      hits_commissions: parseInt(commissions.rows[0].count),
      watchlist_count: parseInt(updates.rows[0].count)
    };
  }

  @Get('findings')
  async getFindings(
    @UserID() userId: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 10;

    const result = await pool.query(`
      SELECT 
        dh.id,
        dh.hit_type as type,
        dh.measure_id as "measureId",
        dh.matched_text as "matchedText",
        dh.keyword,
        dh.created_at as "createdAt",
        m.numero,
        m.titulo,
        m.estado,
        m.fecha_ingreso as "fechaIngreso"
      FROM discovery_hits dh
      JOIN monitor_configs mc ON dh.config_id = mc.id
      JOIN measures m ON dh.measure_id = m.id
      WHERE mc.user_id = $1 
        AND dh.hit_type IN ('KEYWORD', 'TOPIC')
      ORDER BY dh.created_at DESC
      LIMIT $2
    `, [userId, limitNum]);

    return {
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type.toLowerCase(),
        measureId: row.measureId,
        matchedText: row.matchedText || row.keyword,
        keyword: row.keyword,
        createdAt: row.createdAt,
        measure: {
          numero: row.numero,
          titulo: row.titulo,
          estado: row.estado,
          fechaIngreso: row.fechaIngreso
        }
      }))
    };
  }

  @Get('watchlist')
  async getWatchlistItems(
    @UserID() userId: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 10;

    const result = await pool.query(`
      SELECT 
        wi.id,
        wi.measure_id as "measureId",
        wi.updated_at as "updatedAt",
        m.numero,
        m.titulo,
        m.estado,
        m.fecha_ingreso as "fechaIngreso"
      FROM watchlist_items wi
      JOIN monitor_configs mc ON wi.config_id = mc.id
      JOIN measures m ON wi.measure_id = m.id
      WHERE mc.user_id = $1 AND wi.enabled = true
      ORDER BY wi.updated_at DESC
      LIMIT $2
    `, [userId, limitNum]);

    return {
      data: result.rows.map(row => ({
        id: row.id,
        measureId: row.measureId,
        updatedAt: row.updatedAt,
        measure: {
          numero: row.numero,
          titulo: row.titulo,
          estado: row.estado,
          fechaIngreso: row.fechaIngreso
        }
      }))
    };
  }

  @Get('commissions')
  async getCommissionNotifications(
    @UserID() userId: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 10;

    const result = await pool.query(`
      SELECT 
        dh.id,
        dh.measure_id as "measureId",
        dh.matched_text as "commissionName",
        dh.created_at as "createdAt",
        m.numero,
        m.titulo,
        m.estado,
        m.fecha_ingreso as "fechaIngreso"
      FROM discovery_hits dh
      JOIN monitor_configs mc ON dh.config_id = mc.id
      JOIN measures m ON dh.measure_id = m.id
      WHERE mc.user_id = $1 AND dh.hit_type = 'COMMISSION'
      ORDER BY dh.created_at DESC
      LIMIT $2
    `, [userId, limitNum]);

    return {
      data: result.rows.map(row => ({
        id: row.id,
        measureId: row.measureId,
        commissionName: row.commissionName,
        eventType: 'Actualización',
        createdAt: row.createdAt,
        measure: {
          numero: row.numero,
          titulo: row.titulo,
          estado: row.estado,
          fechaIngreso: row.fechaIngreso
        }
      }))
    };
  }
}
