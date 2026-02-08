import { SutraScraper } from '../../scraper/sutra.scraper';
import { DatabaseService } from '../database/database.service';
import { ConfigRepository } from '@lwbeta/db';
import { NotificationService } from '../notifications/notification.service';
export declare class IngestService {
    private readonly scraper;
    private readonly db;
    private readonly configRepo;
    private readonly notificationService;
    private readonly logger;
    constructor(scraper: SutraScraper, db: DatabaseService, configRepo: ConfigRepository, notificationService: NotificationService);
    handleCron(): Promise<void>;
    runIngestion(): Promise<void>;
    private createRunRecord;
    private completeRunRecord;
}
