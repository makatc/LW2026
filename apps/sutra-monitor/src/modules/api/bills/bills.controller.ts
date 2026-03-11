import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { BillsApiService } from './bills.service';
import { Public } from '../../auth/decorators';

@Controller('api/bills')
@Public()
export class BillsController {
    constructor(private readonly service: BillsApiService) {}

    @Get()
    findAll(
        @Query('bill_type') bill_type?: string,
        @Query('status') status?: string,
        @Query('commission') commission?: string,
        @Query('author') author?: string,
        @Query('search') search?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.service.findAll({
            bill_type,
            status,
            commission,
            author,
            search,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    @Get('summary')
    getSummary() {
        return this.service.getSummary();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const bill = await this.service.findOne(id);
        if (!bill) throw new NotFoundException(`Bill ${id} not found`);
        return bill;
    }
}
