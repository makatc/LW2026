import { Controller, Get, Param, Query } from '@nestjs/common';
import { LegislatorsApiService } from './legislators.service';
import { Public } from '../../auth/decorators';

@Controller('api/legislators')
@Public()
export class LegislatorsController {
    constructor(private readonly service: LegislatorsApiService) {}

    @Get()
    findAll(
        @Query('chamber') chamber?: string,
        @Query('party') party?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.service.findAll({
            chamber,
            party,
            limit: limit ? parseInt(limit, 10) : 100,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    @Get('summary')
    getSummary() {
        return this.service.getSummary();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }
}
