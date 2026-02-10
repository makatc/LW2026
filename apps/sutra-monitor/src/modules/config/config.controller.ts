import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserID } from '../auth/decorators';

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
    constructor(private readonly configService: ConfigService) { }

    @Get('webhooks')
    async getWebhooks(@UserID() userId: string) {
        const config = await this.configService.getMyConfig(userId);
        return {
            alertsUrl: config.webhook_alerts || '',
            updatesUrl: config.webhook_sutra_updates || ''
        };
    }

    @Post('webhooks')
    async updateWebhooks(@UserID() userId: string, @Body() body: { alertsUrl: string, updatesUrl: string }) {
        return this.configService.updateWebhooks(userId, body);
    }

    @Get('keywords')
    async listKeywords(@UserID() userId: string) {
        return this.configService.getKeywords(userId);
    }

    @Post('keywords')
    async addKeyword(@UserID() userId: string, @Body('keyword') keyword: string) {
        return this.configService.addKeyword(userId, keyword);
    }

    @Delete('keywords/:id')
    async deleteKeyword(@UserID() userId: string, @Param('id') id: string) {
        return this.configService.deleteKeyword(userId, id);
    }

    // Phrases / Topics
    @Get('phrases')
    async listPhrases(@UserID() userId: string) {
        return this.configService.getPhrases(userId);
    }

    @Post('phrases')
    async addPhrase(@UserID() userId: string, @Body('phrase') phrase: string) {
        return this.configService.addPhrase(userId, phrase);
    }

    @Delete('phrases/:id')
    async deletePhrase(@UserID() userId: string, @Param('id') id: string) {
        return this.configService.deletePhrase(userId, id);
    }

    // Commissions
    @Get('commissions/all')
    async listAllCommissions() {
        // Returns all available commissions from the database
        return this.configService.getAllCommissions();
    }

    @Get('commissions/followed')
    async listFollowedCommissions(@UserID() userId: string) {
        // Returns commissions that the user is following
        return this.configService.getFollowedCommissions(userId);
    }

    @Get('commissions/remote')
    async fetchRemoteCommissions() {
        // Scrapes fresh commission data from SUTRA website
        return this.configService.fetchRemoteCommissions();
    }

    @Post('commissions/seed-official')
    async seedOfficialCommissions() {
        // Seeds the database with the official 2025-2028 commission list
        return this.configService.seedOfficialCommissions();
    }



    @Post('commissions/follow')
    async followCommission(@UserID() userId: string, @Body('commissionId') commissionId: string) {
        return this.configService.followCommission(userId, commissionId);
    }

    @Delete('commissions/follow/:commissionId')
    async unfollowCommission(@UserID() userId: string, @Param('commissionId') commissionId: string) {
        return this.configService.unfollowCommission(userId, commissionId);
    }

    // Watchlist
    @Get('watchlist')
    async listWatchlist(@UserID() userId: string) {
        return this.configService.getWatchlist(userId);
    }

    @Post('watchlist')
    async addToWatchlist(@UserID() userId: string, @Body('measureId') measureId: string) {
        return this.configService.addToWatchlist(userId, measureId);
    }

    @Post('watchlist/by-number')
    async addToWatchlistByNumber(@UserID() userId: string, @Body('number') number: string) {
        return this.configService.addToWatchlistByNumber(userId, number);
    }

    @Delete('watchlist/:measureId')
    async removeFromWatchlist(@UserID() userId: string, @Param('measureId') measureId: string) {
        return this.configService.removeFromWatchlist(userId, measureId);
    }

    @Get('email-preferences')
    async getEmailPreferences(@UserID() userId: string) {
        const config = await this.configService.getMyConfig(userId);
        return this.configService.getEmailPreferences(config.id);
    }

    @Post('email-preferences')
    async updateEmailPreferences(@UserID() userId: string, @Body() body: { enabled: boolean, frequency: 'daily' | 'weekly' }) {
        const config = await this.configService.getMyConfig(userId);
        return this.configService.updateEmailPreferences(config.id, body.enabled, body.frequency);
    }
}
