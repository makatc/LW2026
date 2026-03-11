import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ChangeEventService } from '../../../scrapers/change-event/change-event.service';
import { ChangeEntityType } from '../../../scrapers/change-event/change-event.types';

@Controller('api/change-events')
export class ChangeEventsController {
    constructor(private readonly changeEvents: ChangeEventService) {}

    /**
     * GET /api/change-events
     * Query params:
     *   entity_type  — 'bill' | 'legislator' | 'committee' | 'vote' | 'bill_version'
     *   limit        — max results (default 50)
     *   since        — ISO timestamp (e.g. 2026-03-10T00:00:00Z)
     */
    @Get()
    async list(
        @Query('entity_type') entityType?: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
        @Query('since') since?: string,
    ) {
        const sinceDate = since ? new Date(since) : undefined;
        const rows = await this.changeEvents.getRecent({
            entityType: entityType as ChangeEntityType | undefined,
            limit,
            since: sinceDate,
        });
        return { data: rows, count: rows.length };
    }

    /**
     * GET /api/change-events/stats
     * Returns counts by entity_type.event_type for the last 7 days.
     */
    @Get('stats')
    async stats() {
        return this.changeEvents.getStats();
    }
}
