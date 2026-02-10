import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ComparisonResult } from '../entities/comparison-result.entity';
import { DocumentVersion } from '../entities/document-version.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComparisonResult, DocumentVersion]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
