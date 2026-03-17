import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DossierProject } from '../../entities/dossier-project.entity';
import { DossierDocument } from '../../entities/dossier-document.entity';
import { FiscalContextController } from './fiscal-context.controller';
import { FiscalContextService } from './fiscal-context.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DossierProject, DossierDocument]),
    // Re-use the existing ingestion queue (already registered globally via IngestionModule)
    BullModule.registerQueue({ name: 'document-ingestion' }),
  ],
  controllers: [FiscalContextController],
  providers: [FiscalContextService],
  exports: [FiscalContextService],
})
export class FiscalContextModule {}
