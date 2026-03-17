import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { DossierTransformation, DossierChunk } from '../../entities';
import { TransformationsController } from './transformations.controller';
import { TransformationsService } from './transformations.service';
import { TransformationProcessor } from './transformation.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([DossierTransformation, DossierChunk]),
    BullModule.registerQueue({
      name: 'transformation-queue',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    }),
    HttpModule,
  ],
  controllers: [TransformationsController],
  providers: [TransformationsService, TransformationProcessor],
  exports: [TransformationsService],
})
export class TransformationsModule {}
