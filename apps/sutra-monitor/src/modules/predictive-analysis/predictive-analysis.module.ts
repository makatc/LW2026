import { Module } from '@nestjs/common';
import { PredictiveAnalysisController } from './predictive-analysis.controller';
import { PredictiveAnalysisService } from './predictive-analysis.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PredictiveAnalysisController],
  providers: [PredictiveAnalysisService],
  exports: [PredictiveAnalysisService],
})
export class PredictiveAnalysisModule {}
