import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DossierChunk, DossierConversation, DossierMessage, DossierDocument } from '../../entities';
import { SearchController } from './search.controller';
import { SemanticSearchService } from './semantic-search.service';
import { ConversationService } from './conversation.service';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DossierChunk, DossierConversation, DossierMessage, DossierDocument]),
    IngestionModule,
  ],
  controllers: [SearchController],
  providers: [SemanticSearchService, ConversationService],
  exports: [SemanticSearchService],
})
export class SearchModule {}
