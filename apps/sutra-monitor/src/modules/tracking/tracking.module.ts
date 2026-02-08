import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { SutraClient } from '../../scraper/sutra-client';
import { MeasureRepository } from '@lwbeta/db';

@Module({
    providers: [TrackingService, SutraClient, MeasureRepository],
    exports: [TrackingService],
})
export class ActiveTrackingModule { }
