import { Controller, Get, Patch, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ExecutiveRadarService } from './executive-radar.service';
import { Public } from '../auth/decorators';
import { UserID } from '../auth/decorators';

@Controller('api/executive')
export class ExecutiveRadarController {
  constructor(private readonly service: ExecutiveRadarService) {}

  // ─── Public routes ────────────────────────────────────────────────────────────

  @Get('orders')
  @Public()
  async getOrders(
    @Query('sector') sector?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getOrders({
      sector,
      year: year ? parseInt(year, 10) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    });
  }

  // IMPORTANT: /orders/alerts must be declared BEFORE /orders/:id to avoid route conflicts
  @Get('orders/alerts')
  async getUserAlerts(@UserID() userId: string) {
    return this.service.getUserAlerts(userId || 'anonymous');
  }

  @Get('orders/:id')
  @Public()
  async getOrderById(@Param('id') id: string) {
    return this.service.getOrderById(id);
  }

  // ─── Protected routes ─────────────────────────────────────────────────────────

  @Patch('orders/alerts/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismissAlert(@Param('id') alertId: string, @UserID() userId: string) {
    await this.service.dismissAlert(alertId, userId || 'anonymous');
  }
}
