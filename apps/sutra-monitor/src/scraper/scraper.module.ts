import { Module } from '@nestjs/common';
import { SutraScraper } from './sutra.scraper';

@Module({
    providers: [SutraScraper],
    exports: [SutraScraper],
})
export class ScraperModule { }
