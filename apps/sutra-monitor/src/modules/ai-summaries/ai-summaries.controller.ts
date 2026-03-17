import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { AiSummariesService } from './ai-summaries.service';
import { SummaryType } from './ai-summaries.constants';
import { UserID } from '../auth/decorators';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

interface GenerateSummaryDto {
  summary_type: SummaryType;
}

interface GenerateDiffSummaryDto {
  version_from_id: string;
  version_to_id: string;
}

interface GenerateAudioBriefingDto {
  /** Optional pre-fetched briefing data. If omitted, service fetches from dashboard_briefings. */
  briefing_data?: Record<string, unknown>;
}

const VALID_SUMMARY_TYPES: SummaryType[] = ['executive', 'technical_legal', 'tweet'];

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('api/ai')
export class AiSummariesController {
  constructor(private readonly service: AiSummariesService) {}

  // ─── Summaries ─────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/summary/:billId
   * Body: { summary_type: 'executive' | 'technical_legal' | 'tweet' }
   * Requires JWT authentication.
   */
  @Post('summary/:billId')
  async generateSummary(
    @Param('billId') billId: string,
    @Body() dto: GenerateSummaryDto,
    @UserID() userId: string,
  ) {
    const summaryType = dto?.summary_type;

    if (!summaryType || !VALID_SUMMARY_TYPES.includes(summaryType)) {
      throw new BadRequestException(
        `summary_type must be one of: ${VALID_SUMMARY_TYPES.join(', ')}`,
      );
    }

    return this.service.generateSummary(billId, summaryType, userId);
  }

  /**
   * GET /api/ai/summary/:billId
   * Returns all summaries for a bill (all types, any age).
   * Requires JWT authentication.
   */
  @Get('summary/:billId')
  async getSummaries(@Param('billId') billId: string) {
    return this.service.getSummaries(billId);
  }

  // ─── Diff Summaries ────────────────────────────────────────────────────────

  /**
   * POST /api/ai/summary/:billId/diff
   * Body: { version_from_id, version_to_id }
   * Requires JWT authentication.
   */
  @Post('summary/:billId/diff')
  async generateDiffSummary(
    @Param('billId') billId: string,
    @Body() dto: GenerateDiffSummaryDto,
    @UserID() userId: string,
  ) {
    if (!dto?.version_from_id || !dto?.version_to_id) {
      throw new BadRequestException('version_from_id and version_to_id are required');
    }

    return this.service.generateDiffSummary(
      billId,
      dto.version_from_id,
      dto.version_to_id,
      userId,
    );
  }

  /**
   * GET /api/ai/summary/:billId/diff
   * Returns all diff summaries for a bill.
   * Requires JWT authentication.
   */
  @Get('summary/:billId/diff')
  async getDiffSummaries(@Param('billId') billId: string) {
    return this.service.getDiffSummaries(billId);
  }

  // ─── Audio Briefing ────────────────────────────────────────────────────────

  /**
   * GET /api/ai/audio-briefing/today
   * Returns today's audio briefing for the authenticated user.
   * Requires JWT authentication.
   */
  @Get('audio-briefing/today')
  async getAudioBriefingToday(@UserID() userId: string) {
    if (!userId) {
      // Guard: JwtAuthGuard should prevent this, but be explicit
      throw new BadRequestException('User authentication required');
    }

    const briefing = await this.service.getAudioBriefingToday(userId);

    if (!briefing) {
      // Auto-generate if none exists for today
      const briefingData = await this.service.getBriefingDataForUser(userId);
      return this.service.generateAudioBriefing(userId, briefingData);
    }

    return briefing;
  }

  /**
   * POST /api/ai/audio-briefing/today
   * Force-generates or regenerates today's audio briefing for the authenticated user.
   * Body: { briefing_data? } — optional pre-fetched data; will be fetched automatically if omitted.
   * Requires JWT authentication.
   */
  @Post('audio-briefing/today')
  async generateAudioBriefing(
    @UserID() userId: string,
    @Body() dto: GenerateAudioBriefingDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const briefingData = dto?.briefing_data
      ? dto.briefing_data
      : await this.service.getBriefingDataForUser(userId);

    return this.service.generateAudioBriefing(userId, briefingData);
  }
}
