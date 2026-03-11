import { Module } from '@nestjs/common';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
    imports: [PipelineModule],
    providers: [ScraperSchedulerService],
})
export class ScraperSchedulerModule {}
