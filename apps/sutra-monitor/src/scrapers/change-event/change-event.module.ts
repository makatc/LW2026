import { Module } from '@nestjs/common';
import { ChangeEventService } from './change-event.service';
import { DatabaseModule } from '../../modules/database/database.module';

@Module({
    imports: [DatabaseModule],
    providers: [ChangeEventService],
    exports: [ChangeEventService],
})
export class ChangeEventModule {}
