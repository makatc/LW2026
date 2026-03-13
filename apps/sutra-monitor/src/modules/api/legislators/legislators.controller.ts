import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { LegislatorsApiService } from './legislators.service';
import { Public } from '../../auth/decorators';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('api/legislators')
export class LegislatorsController {
    constructor(private readonly service: LegislatorsApiService) { }

    @Get()
    @Public()
    findAll(
        @Query('chamber') chamber?: string,
        @Query('party') party?: string,
        @Query('committee') committee?: string,
        @Query('search') search?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.service.findAll({
            chamber,
            party,
            committee,
            search,
            limit: limit ? parseInt(limit, 10) : 100,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    @Get('summary')
    @Public()
    getSummary() {
        return this.service.getSummary();
    }

    @Get(':id')
    @Public()
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.service.findOne(id, req?.user?.userId);
    }

    @Post()
    create(@Body() body: {
        full_name: string;
        chamber: string;
        party?: string;
        district?: string;
        email?: string;
        phone?: string;
        office?: string;
        photo_url?: string;
    }) {
        return this.service.create(body);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: Record<string, any>) {
        return this.service.update(id, body);
    }

    @Patch(':id/private-metadata')
    @UseGuards(JwtAuthGuard)
    async updatePrivateMetadata(
        @Param('id') id: string,
        @Body() body: Record<string, any>,
        @Req() req: any
    ) {
        try {
            if (!req.user || !req.user.userId) {
                return { error: 'Missing user info', reqUser: req.user };
            }
            return await this.service.updatePrivateMetadata(id, req.user.userId, body);
        } catch (err: any) {
            return { error: err.message, stack: err.stack };
        }
    }

    // ─── Staff ────────────────────────────────────────────────────────────────

    @Get(':id/staff')
    @Public()
    getStaff(@Param('id') legislatorId: string) {
        return this.service.getStaff(legislatorId);
    }

    @Post(':id/staff')
    addStaff(
        @Param('id') legislatorId: string,
        @Body() body: { name: string; title: string; email?: string },
    ) {
        return this.service.addStaff(legislatorId, body);
    }

    // ─── Committees ───────────────────────────────────────────────────────────

    @Get(':id/committees')
    @Public()
    getCommittees(@Param('id') legislatorId: string) {
        return this.service.getCommittees(legislatorId);
    }

    // ─── Interactions (shortcut from legislator context) ──────────────────────

    @Get(':id/interactions')
    @Public()
    getInteractions(
        @Param('id') legislatorId: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.service.getInteractions(legislatorId, {
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    // ─── Intelligence ─────────────────────────────────────────────────────────

    @Get(':id/intelligence-profile')
    @Public()
    getIntelligenceProfile(@Param('id') legislatorId: string) {
        return this.service.getIntelligenceProfile(legislatorId);
    }

    @Get(':id/positions')
    @Public()
    getPositions(@Param('id') legislatorId: string) {
        return this.service.getPositions(legislatorId);
    }
}
