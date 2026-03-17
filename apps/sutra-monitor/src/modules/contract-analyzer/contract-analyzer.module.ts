import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ContractAnalyzerController } from './contract-analyzer.controller';
import { ContractAnalyzerService } from './contract-analyzer.service';
import { PrLegalCorpusSyncService } from './pr-legal-corpus-sync.service';
import { DatabaseModule } from '../database/database.module';
import { CONTRACT_ANALYZER_CONSTANTS } from './contract-analyzer.constants';

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({
      dest: process.env.CONTRACT_UPLOAD_DIR || '/tmp/contracts',
      limits: {
        fileSize: CONTRACT_ANALYZER_CONSTANTS.MAX_FILE_SIZE_BYTES,
      },
    }),
  ],
  controllers: [ContractAnalyzerController],
  providers: [ContractAnalyzerService, PrLegalCorpusSyncService],
  exports: [ContractAnalyzerService, PrLegalCorpusSyncService],
})
export class ContractAnalyzerModule {}
