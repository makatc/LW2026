import { Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../auth/decorators';
import { DojRegistryScraperService } from './doj-registry-scraper.service';

@Controller('api/doj-registry')
@Public()
export class DojRegistryController {
    constructor(private readonly scraper: DojRegistryScraperService) {}

    /**
     * POST /api/doj-registry/scrape
     * Triggers a scrape of the DOJ public registry.
     * In production, this would be a scheduled job.
     */
    @Post('scrape')
    async scrape() {
        return this.scraper.scrapeRegistry();
    }

    /**
     * GET /api/doj-registry/lobbyists
     * Returns all scraped lobbyists/firms from the DOJ registry.
     */
    @Get('lobbyists')
    async getLobbyists(@Query('search') search?: string) {
        return this.scraper.getLobbyists(search);
    }

    /**
     * GET /api/doj-registry/lobbyists-for-legislator/:legislatorName
     * Returns lobbyists who have declared activity with a specific legislator.
     */
    @Get('lobbyists-for-legislator')
    async getLobbyistsForLegislator(@Query('legislator_name') legislatorName: string) {
        return this.scraper.getLobbyistsForLegislator(legislatorName);
    }

    /**
     * GET /api/doj-registry/last-scrape
     * Returns the last scrape timestamp and stats.
     */
    @Get('last-scrape')
    async getLastScrapeInfo() {
        return this.scraper.getLastScrapeInfo();
    }
}
