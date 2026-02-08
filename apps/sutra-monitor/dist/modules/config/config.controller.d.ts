import { ConfigService } from './config.service';
export declare class ConfigController {
    private readonly configService;
    constructor(configService: ConfigService);
    getWebhooks(userId: string): Promise<{
        alertsUrl: string;
        updatesUrl: string;
    }>;
    updateWebhooks(userId: string, body: {
        alertsUrl: string;
        updatesUrl: string;
    }): Promise<import("@lwbeta/types").MonitorConfig>;
    listKeywords(userId: string): Promise<import("@lwbeta/types").KeywordRule[]>;
    addKeyword(userId: string, keyword: string): Promise<import("@lwbeta/types").KeywordRule>;
    deleteKeyword(userId: string, id: string): Promise<void>;
    listPhrases(userId: string): Promise<any[]>;
    addPhrase(userId: string, phrase: string): Promise<any>;
    deletePhrase(userId: string, id: string): Promise<void>;
    listAllCommissions(): Promise<import("@lwbeta/types").SutraCommission[]>;
    listFollowedCommissions(userId: string): Promise<any[]>;
    fetchRemoteCommissions(): Promise<import("@lwbeta/types").SutraCommission[]>;
    seedOfficialCommissions(): Promise<import("@lwbeta/types").SutraCommission[]>;
    followCommission(userId: string, commissionId: string): Promise<any>;
    unfollowCommission(userId: string, commissionId: string): Promise<void>;
    listWatchlist(userId: string): Promise<any[]>;
    addToWatchlist(userId: string, measureId: string): Promise<any>;
    addToWatchlistByNumber(userId: string, number: string): Promise<any>;
    removeFromWatchlist(userId: string, measureId: string): Promise<void>;
}
