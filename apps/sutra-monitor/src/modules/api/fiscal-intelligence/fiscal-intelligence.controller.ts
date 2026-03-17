import { Controller, Get, Param, Query } from '@nestjs/common';
import { FiscalIntelligenceService } from './fiscal-intelligence.service';
import { Public } from '../../auth/decorators';

@Controller('api')
@Public()
export class FiscalIntelligenceController {
  constructor(private readonly service: FiscalIntelligenceService) {}

  // ─── Fiscal Notes ──────────────────────────────────────────────────────────

  @Get('bills/:id/fiscal-notes')
  async getFiscalNotesByBill(@Param('id') id: string) {
    return this.service.getFiscalNotesByBill(id);
  }

  @Get('fiscal-notes/by-agency')
  async getFiscalNotesByAgency() {
    return this.service.getFiscalNotesByAgency();
  }

  @Get('fiscal-notes')
  async getAllFiscalNotes(
    @Query('agency') agency?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getAllFiscalNotes({
      agency,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  // ─── FOMB Actions ──────────────────────────────────────────────────────────

  @Get('bills/:id/fomb-actions')
  async getFombActionsByBill(@Param('id') id: string) {
    return this.service.getFombActionsByBill(id);
  }

  @Get('fomb/recent')
  async getRecentFombActions(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getRecentFombActions({
      status,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard/briefing')
  async getBriefing(
    @Query('user_id') userId: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.service.getBriefing(userId || 'anonymous', refresh === 'true');
  }

  @Get('dashboard/portfolio-summary')
  async getPortfolioSummary(@Query('user_id') userId: string) {
    return this.service.getPortfolioSummary(userId || 'anonymous');
  }

  @Get('dashboard/calendar')
  async getCalendar() {
    return this.service.getCalendar();
  }

  @Get('dashboard/fomb-risk')
  async getFombRisk(@Query('user_id') userId: string) {
    return this.service.getFombRisk(userId || 'anonymous');
  }
}
