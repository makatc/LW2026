import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DossierDocument, DossierChunk, DossierProject } from '../../entities';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { DocumentProcessor } from './document.processor';
import { EmbeddingService } from './embedding.service';
import { LegislativeChunker } from './legislative-chunker';

@Module({
  imports: [
    TypeOrmModule.forFeature([DossierDocument, DossierChunk, DossierProject]),
    BullModule.registerQueue({
      name: 'document-ingestion',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    }),
  ],
  controllers: [IngestionController],
  providers: [IngestionService, DocumentProcessor, EmbeddingService, LegislativeChunker],
  exports: [IngestionService, EmbeddingService],
})
export class IngestionModule {}
