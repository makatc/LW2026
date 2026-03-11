import { Module } from '@nestjs/common';
import { ChangeEventsController } from './change-events.controller';
import { ChangeEventModule } from '../../../scrapers/change-event/change-event.module';

@Module({
    imports: [ChangeEventModule],
    controllers: [ChangeEventsController],
})
export class ChangeEventsApiModule {}
