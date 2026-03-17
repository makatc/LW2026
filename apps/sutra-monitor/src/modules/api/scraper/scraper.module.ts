import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { PipelineModule } from '../../../scrapers/pipeline/pipeline.module';
import { DatabaseModule } from '../../database/database.module';
import { ScraperRunRecorder } from '../../../scrapers/scraper-run.recorder';
import { FiscalIntelligenceScraperModule } from '../../../scrapers/fiscal-intelligence/fiscal-intelligence-scraper.module';

@Module({
    imports: [PipelineModule, DatabaseModule, FiscalIntelligenceScraperModule],
    controllers: [ScraperController],
    providers: [ScraperRunRecorder],
})
export class ScraperApiModule {}
