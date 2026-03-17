import { Module } from '@nestjs/common';
import { AiSummariesController } from './ai-summaries.controller';
import { AiSummariesService } from './ai-summaries.service';
import { AiSummariesSchedulerService } from './ai-summaries-scheduler.service';

// DatabaseModule is @Global() — no need to import it explicitly.
// ScheduleModule is registered globally in AppModule via ScheduleModule.forRoot().

@Module({
  controllers: [AiSummariesController],
  providers: [AiSummariesService, AiSummariesSchedulerService],
  exports: [AiSummariesService],
})
export class AiSummariesModule {}
