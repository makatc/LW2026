import { CommissionRepository } from '@lwbeta/db';
export declare class CommissionService {
    private readonly commissionRepo;
    constructor(commissionRepo: CommissionRepository);
    listAll(): Promise<import("@lwbeta/types").SutraCommission[]>;
}
export declare class CommissionController {
    private readonly commissionService;
    constructor(commissionService: CommissionService);
    listAll(): Promise<import("@lwbeta/types").SutraCommission[]>;
}
