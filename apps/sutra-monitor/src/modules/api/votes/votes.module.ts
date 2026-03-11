import { Module } from '@nestjs/common';
import { VotesController } from './votes.controller';
import { VotesApiService } from './votes.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [VotesController],
    providers: [VotesApiService],
})
export class VotesApiModule {}
