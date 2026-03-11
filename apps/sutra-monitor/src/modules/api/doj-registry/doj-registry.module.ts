import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DojRegistryController } from './doj-registry.controller';
import { DojRegistryScraperService } from './doj-registry-scraper.service';

@Module({
    imports: [DatabaseModule],
    controllers: [DojRegistryController],
    providers: [DojRegistryScraperService],
    exports: [DojRegistryScraperService],
})
export class DojRegistryModule {}
