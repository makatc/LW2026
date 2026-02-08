import { MonitorConfig, KeywordRule } from '@lwbeta/types';
export declare class ConfigRepository {
    getOrCreateDefaultConfig(userId?: string): Promise<MonitorConfig>;
    updateWebhooks(configId: string, alertsUrl: string, updatesUrl: string): Promise<MonitorConfig>;
    addKeywordRule(configId: string, keyword: string): Promise<KeywordRule>;
    getKeywords(configId: string): Promise<KeywordRule[]>;
    deleteKeywordRule(id: string): Promise<void>;
    getAllActiveRules(): Promise<(KeywordRule & {
        webhook_alerts?: string;
    })[]>;
    getUpdateWebhooks(): Promise<string[]>;
    addPhraseRule(configId: string, phrase: string): Promise<any>;
    getPhraseRules(configId: string): Promise<any[]>;
    deletePhraseRule(id: string): Promise<void>;
    followCommission(configId: string, commissionId: string): Promise<any>;
    unfollowCommission(configId: string, commissionId: string): Promise<void>;
    getFollowedCommissions(configId: string): Promise<any[]>;
    addToWatchlist(configId: string, measureId: string | null, addedFrom: string, measureNumber?: string): Promise<any>;
    removeFromWatchlist(configId: string, measureId: string): Promise<void>;
    getWatchlist(configId: string): Promise<any[]>;
    getEmailPreferences(configId: string): Promise<{
        enabled: boolean;
        frequency: string;
    } | null>;
    updateEmailPreferences(configId: string, enabled: boolean, frequency: 'daily' | 'weekly'): Promise<void>;
}
