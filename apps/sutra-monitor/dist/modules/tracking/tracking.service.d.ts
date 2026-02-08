import { SutraClient } from '../../scraper/sutra-client';
import { MeasureRepository } from '@lwbeta/db';
export declare class TrackingService {
    private readonly sutraClient;
    private readonly measureRepo;
    constructor(sutraClient: SutraClient, measureRepo: MeasureRepository);
    runTrackingJob(): Promise<void>;
}
