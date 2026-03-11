import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { PipelineModule } from '../../../scrapers/pipeline/pipeline.module';
import { DatabaseModule } from '../../database/database.module';
import { ScraperRunRecorder } from '../../../scrapers/scraper-run.recorder';

@Module({
    imports: [PipelineModule, DatabaseModule],
    controllers: [ScraperController],
    providers: [ScraperRunRecorder],
})
export class ScraperApiModule {}
