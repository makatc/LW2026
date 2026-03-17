import { Module } from '@nestjs/common';
import { FiscalIntelligenceController } from './fiscal-intelligence.controller';
import { FiscalIntelligenceService } from './fiscal-intelligence.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FiscalIntelligenceController],
  providers: [FiscalIntelligenceService],
  exports: [FiscalIntelligenceService],
})
export class FiscalIntelligenceModule {}
