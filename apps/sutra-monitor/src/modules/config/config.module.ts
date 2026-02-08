import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { ConfigRepository } from '@lwbeta/db';
import { ScraperModule } from '../../scraper/scraper.module';

@Module({
    imports: [ScraperModule],
    controllers: [ConfigController],
    providers: [ConfigService, ConfigRepository],
    exports: [ConfigService]
})
export class MonitorConfigModule { }
