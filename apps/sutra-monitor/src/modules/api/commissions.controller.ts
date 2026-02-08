import { Controller, Get } from '@nestjs/common';
import { CommissionRepository } from '@lwbeta/db';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CommissionService {
    constructor(private readonly commissionRepo: CommissionRepository) { }

    async listAll() {
        return this.commissionRepo.listall();
    }
}

@Controller('commissions')
export class CommissionController {
    constructor(private readonly commissionService: CommissionService) { }

    @Get()
    async listAll() {
        return this.commissionService.listAll();
    }
}
