import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [InteractionsController],
    providers: [InteractionsService],
    exports: [InteractionsService],
})
export class InteractionsApiModule {}
