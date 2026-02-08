import { ConfigService } from '../config/config.service';
export declare class DashboardController {
    private readonly configService;
    constructor(configService: ConfigService);
    getSummary(userId: string): Promise<{
        hits_keyword: number;
        hits_topics: number;
        hits_commissions: number;
        watchlist_count: number;
    }>;
    getFindings(userId: string, limit?: string): Promise<{
        data: {
            id: any;
            type: any;
            measureId: any;
            matchedText: any;
            keyword: any;
            createdAt: any;
            measure: {
                numero: any;
                titulo: any;
                estado: any;
                fechaIngreso: any;
            };
        }[];
    }>;
    getWatchlistItems(userId: string, limit?: string): Promise<{
        data: {
            id: any;
            measureId: any;
            updatedAt: any;
            measure: {
                numero: any;
                titulo: any;
                estado: any;
                fechaIngreso: any;
            };
        }[];
    }>;
    getCommissionNotifications(userId: string, limit?: string): Promise<{
        data: {
            id: any;
            measureId: any;
            commissionName: any;
            eventType: string;
            createdAt: any;
            measure: {
                numero: any;
                titulo: any;
                estado: any;
                fechaIngreso: any;
            };
        }[];
    }>;
}
