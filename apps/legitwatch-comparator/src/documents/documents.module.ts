import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  SourceSnapshot,
  Document,
  DocumentVersion,
  DocumentChunk,
} from '../entities';
import { DocumentsController } from './documents.controller';
import {
  IngestionService,
  StructureDetectorService,
  NormalizerService,
  FileParserService,
  UploadService,
} from './services';
import { IngestionProcessor } from './processors/ingestion.processor';

/**
 * DocumentsModule
 * Handles document ingestion, parsing, and structure detection
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SourceSnapshot,
      Document,
      DocumentVersion,
      DocumentChunk,
    ]),
    BullModule.registerQueue({
      name: 'ingestion-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    IngestionService,
    StructureDetectorService,
    NormalizerService,
    FileParserService,
    UploadService,
    IngestionProcessor,
  ],
  exports: [
    IngestionService,
    StructureDetectorService,
    NormalizerService,
    FileParserService,
    UploadService,
  ],
})
export class DocumentsModule {}
