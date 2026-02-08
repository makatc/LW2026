import { ConfigRepository, CommissionRepository } from '@lwbeta/db';
import { KeywordRule, MonitorConfig } from '@lwbeta/types';
import { SutraScraper } from '../../scraper/sutra.scraper';
export declare class ConfigService {
    private readonly configRepo;
    private readonly commissionRepo;
    private readonly scraper;
    constructor(configRepo: ConfigRepository, commissionRepo: CommissionRepository, scraper: SutraScraper);
    fetchRemoteCommissions(): Promise<import("@lwbeta/types").SutraCommission[]>;
    getAllCommissions(): Promise<import("@lwbeta/types").SutraCommission[]>;
    getMyConfig(userId?: string): Promise<MonitorConfig>;
    updateWebhooks(userId: string | undefined, data: {
        alertsUrl: string;
        updatesUrl: string;
    }): Promise<MonitorConfig>;
    getAllActiveRules(): Promise<KeywordRule[]>;
    addKeyword(userId: string | undefined, keyword: string): Promise<KeywordRule>;
    getKeywords(userId?: string): Promise<KeywordRule[]>;
    deleteKeyword(userId: string | undefined, id: string): Promise<void>;
    addPhrase(userId: string | undefined, phrase: string): Promise<any>;
    getPhrases(userId?: string): Promise<any[]>;
    deletePhrase(userId: string | undefined, id: string): Promise<void>;
    followCommission(userId: string | undefined, commissionId: string): Promise<any>;
    unfollowCommission(userId: string | undefined, commissionId: string): Promise<void>;
    getFollowedCommissions(userId?: string): Promise<any[]>;
    addToWatchlist(userId: string | undefined, measureId: string): Promise<any>;
    addToWatchlistByNumber(userId: string | undefined, measureNumber: string): Promise<any>;
    getWatchlist(userId?: string): Promise<any[]>;
    removeFromWatchlist(userId: string | undefined, measureId: string): Promise<void>;
    seedOfficialCommissions(): Promise<import("@lwbeta/types").SutraCommission[]>;
    getEmailPreferences(configId: string): Promise<{
        enabled: boolean;
        frequency: string;
    } | null>;
    updateEmailPreferences(configId: string, enabled: boolean, frequency: 'daily' | 'weekly'): Promise<void>;
}
