export declare class SystemRepository {
    getSetting(key: string): Promise<string | null>;
    setSetting(key: string, value: string): Promise<void>;
    getDiscoveryCursor(): Promise<Date>;
    setDiscoveryCursor(date: Date): Promise<void>;
}
