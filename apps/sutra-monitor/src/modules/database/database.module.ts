import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigRepository, MeasureRepository, CommissionRepository, SystemRepository } from '@lwbeta/db';

@Global()
@Module({
    providers: [
        DatabaseService,
        ConfigRepository,
        MeasureRepository,
        CommissionRepository,
        SystemRepository
    ],
    exports: [
        DatabaseService,
        ConfigRepository,
        MeasureRepository,
        CommissionRepository,
        SystemRepository
    ],
})
export class DatabaseModule { }
