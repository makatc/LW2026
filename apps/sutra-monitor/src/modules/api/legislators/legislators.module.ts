import { Module } from '@nestjs/common';
import { LegislatorsController } from './legislators.controller';
import { LegislatorsApiService } from './legislators.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [LegislatorsController],
    providers: [LegislatorsApiService],
})
export class LegislatorsApiModule {}
