import { ConfigService } from '../config/config.service';
import { IngestService } from '../ingest/ingest.service';
import { NotificationService } from '../notifications/notification.service';
export declare class ApiController {
    private readonly configService;
    private readonly ingestService;
    private readonly notificationService;
    private readonly logger;
    constructor(configService: ConfigService, ingestService: IngestService, notificationService: NotificationService);
    listMeasures(): Promise<{
        measures: any[];
    }>;
    listCommissions(): Promise<{
        commissions: any[];
    }>;
    triggerNotifications(): Promise<{
        success: boolean;
        message: string;
    }>;
    addToWatchlist(measureId: string): Promise<any>;
    addToWatchlistByNumber(body: {
        number: string;
    }): Promise<{
        success: boolean;
        measure: any;
        watchlistItem: any;
        pending?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        pending: boolean;
        message: string;
        watchlistItem: any;
        measure?: undefined;
    }>;
    getMeasureDetail(id: string): Promise<{
        measure: any;
        history: any[];
    }>;
    triggerIngest(): Promise<{
        message: string;
    }>;
    getEmailPreferences(): Promise<{
        enabled: boolean;
        frequency: string;
    }>;
    saveEmailPreferences(body: {
        enabled: boolean;
        frequency: 'daily' | 'weekly';
    }): Promise<{
        success: boolean;
    }>;
    fixSchema(): Promise<{
        message: string;
        status?: undefined;
    } | {
        status: string;
        message: any;
    }>;
}
