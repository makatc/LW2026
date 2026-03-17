import { Module } from '@nestjs/common';
import { OgpScraper } from './ogp.scraper';
import { HaciendaScraper } from './hacienda.scraper';
import { FombScraper } from './fomb.scraper';
import { FiscalScraperSchedulerService } from './fiscal-scraper-scheduler.service';
import { DatabaseModule } from '../../modules/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    OgpScraper,
    HaciendaScraper,
    FombScraper,
    FiscalScraperSchedulerService,
  ],
  exports: [OgpScraper, HaciendaScraper, FombScraper, FiscalScraperSchedulerService],
})
export class FiscalIntelligenceScraperModule {}
