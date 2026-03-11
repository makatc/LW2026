import { Controller, Get, Param, Query } from '@nestjs/common';
import { CommitteesApiService } from './committees.service';
import { Public } from '../../auth/decorators';

@Controller('api/committees')
@Public()
export class CommitteesController {
    constructor(private readonly service: CommitteesApiService) {}

    @Get()
    findAll(
        @Query('chamber') chamber?: string,
        @Query('type') type?: string,
    ) {
        return this.service.findAll({ chamber, type });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }
}
