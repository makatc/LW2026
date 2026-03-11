import { Controller, Get, Param, Query } from '@nestjs/common';
import { VotesApiService } from './votes.service';
import { Public } from '../../auth/decorators';

@Controller('api/votes')
@Public()
export class VotesController {
    constructor(private readonly service: VotesApiService) {}

    @Get('recent')
    getRecent(@Query('limit') limit?: string) {
        return this.service.getRecent(limit ? parseInt(limit, 10) : 10);
    }

    @Get(':billId')
    findByBill(@Param('billId') billId: string) {
        return this.service.findByBill(billId);
    }
}
