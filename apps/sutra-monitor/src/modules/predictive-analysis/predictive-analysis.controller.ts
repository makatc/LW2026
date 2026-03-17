import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { PredictiveAnalysisService } from './predictive-analysis.service';
import { Public } from '../auth/decorators';
import { UserID } from '../auth/decorators';

@Controller('api/predictive')
export class PredictiveAnalysisController {
  private readonly logger = new Logger(PredictiveAnalysisController.name);

  constructor(private readonly service: PredictiveAnalysisService) {}

  // IMPORTANT: /portfolio-overview must be declared BEFORE /:billId to avoid route conflicts
  @Get('portfolio-overview')
  async getPortfolioOverview(@UserID() userId: string) {
    return this.service.getPortfolioOverview(userId || 'anonymous');
  }

  @Get(':billId')
  @Public()
  async getViabilityScore(@Param('billId') billId: string) {
    return this.service.getViabilityScore(billId);
  }

  @Post(':billId/recalculate')
  async recalculate(@Param('billId') billId: string) {
    return this.service.recalculate(billId);
  }
}
