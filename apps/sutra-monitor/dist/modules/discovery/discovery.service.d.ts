import { ConfigService } from '../config/config.service';
import { MeasureRepository, SystemRepository } from '@lwbeta/db';
import { NotificationService } from '../notifications/notification.service';
export declare class DiscoveryService {
    private readonly configService;
    private readonly measureRepo;
    private readonly systemRepo;
    private readonly notificationService;
    constructor(configService: ConfigService, measureRepo: MeasureRepository, systemRepo: SystemRepository, notificationService: NotificationService);
    runDiscoveryJob(): Promise<void>;
    private matchKeyword;
    private processHit;
}
