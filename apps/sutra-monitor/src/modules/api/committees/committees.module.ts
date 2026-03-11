import { Module } from '@nestjs/common';
import { CommitteesController } from './committees.controller';
import { CommitteesApiService } from './committees.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [CommitteesController],
    providers: [CommitteesApiService],
})
export class CommitteesApiModule {}
