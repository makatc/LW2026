import { Module } from '@nestjs/common';
import { BillsController } from './bills.controller';
import { BillsApiService } from './bills.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [BillsController],
    providers: [BillsApiService],
    exports: [BillsApiService],
})
export class BillsApiModule {}
