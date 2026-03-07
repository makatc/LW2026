import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  DocumentVersion,
  DocumentChunk,
  ComparisonResult,
} from '../entities';
import { ComparisonController } from './comparison.controller';
import { DiffService, ComparisonService } from './services';
import { LlmAnalysisService } from './services/llm-analysis.service';
import { CompareProcessor } from './processors/compare.processor';
import { LegalModule } from '../legal/legal.module';

/**
 * ComparisonModule
 * Handles document comparison and diff generation
 */
@Module({
  imports: [
    ConfigModule,
    LegalModule,
    TypeOrmModule.forFeature([
      DocumentVersion,
      DocumentChunk,
      ComparisonResult,
    ]),
    BullModule.registerQueue({
      name: 'comparison-queue',
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    }),
  ],
  controllers: [ComparisonController],
  providers: [
    DiffService,
    ComparisonService,
    LlmAnalysisService,
    CompareProcessor,
  ],
  exports: [DiffService, ComparisonService, LlmAnalysisService],
})
export class ComparisonModule {}
