import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiSummariesService } from './ai-summaries.service';

@Injectable()
export class AiSummariesSchedulerService {
  private readonly logger = new Logger(AiSummariesSchedulerService.name);

  constructor(private readonly aiSummariesService: AiSummariesService) {}

  /**
   * Generate daily audio briefings for all active users.
   *
   * Puerto Rico is UTC-4 (no DST).
   * We target 6:00 AM PR time = 10:00 AM UTC.
   * The timeZone option in @Cron ensures the expression is evaluated in PR time.
   */
  @Cron('0 10 * * *', { timeZone: 'America/Puerto_Rico' })
  async generateDailyAudioBriefings(): Promise<void> {
    this.logger.log('Starting daily audio briefing generation...');

    let userIds: string[];
    try {
      userIds = await this.aiSummariesService.getActiveUserIds();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch active user IDs: ${message}`);
      return;
    }

    if (userIds.length === 0) {
      this.logger.log('No active users found — skipping audio briefing generation');
      return;
    }

    this.logger.log(`Generating audio briefings for ${userIds.length} active user(s)...`);

    let succeeded = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        // Fetch the pre-built briefing data for this user (reuses dashboard_briefings cache)
        const briefingData = await this.aiSummariesService.getBriefingDataForUser(userId);

        // Generate (or regenerate) the audio briefing
        await this.aiSummariesService.generateAudioBriefing(userId, briefingData);

        succeeded++;
      } catch (err: unknown) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to generate audio briefing for user ${userId}: ${message}`);
      }
    }

    this.logger.log(
      `Daily audio briefing generation complete — succeeded: ${succeeded}, failed: ${failed}`,
    );
  }
}
