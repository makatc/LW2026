import { Module } from '@nestjs/common';
import { ExecutiveRadarController } from './executive-radar.controller';
import { ExecutiveRadarService } from './executive-radar.service';
import { ExecutiveOrderScraperService } from './executive-order-scraper.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExecutiveRadarController],
  providers: [ExecutiveRadarService, ExecutiveOrderScraperService],
  exports: [ExecutiveRadarService, ExecutiveOrderScraperService],
})
export class ExecutiveRadarModule {}
