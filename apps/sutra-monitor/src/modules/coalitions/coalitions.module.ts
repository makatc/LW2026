import { Module } from '@nestjs/common';
import { CoalitionsController } from './coalitions.controller';
import { CoalitionsService } from './coalitions.service';
import { LobbyistRegistryScraperService } from './lobbyist-registry-scraper.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CoalitionsController],
  providers: [CoalitionsService, LobbyistRegistryScraperService],
  exports: [CoalitionsService],
})
export class CoalitionsModule {}
