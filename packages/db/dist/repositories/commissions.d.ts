import { SutraCommission } from '@lwbeta/types';
export declare class CommissionRepository {
    listall(): Promise<SutraCommission[]>;
    findById(id: string): Promise<SutraCommission | null>;
    findByName(name: string): Promise<SutraCommission | null>;
    upsert(name: string, category?: string): Promise<SutraCommission>;
}
