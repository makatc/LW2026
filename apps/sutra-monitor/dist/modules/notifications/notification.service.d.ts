import { ConfigService as EnvConfigService } from '@nestjs/config';
import { ConfigService } from '../config/config.service';
import { SystemRepository } from '@lwbeta/db';
import { SutraMeasure } from '@lwbeta/types';
export declare class NotificationService {
    private envConfigService;
    private configService;
    private systemRepo;
    private readonly logger;
    constructor(envConfigService: EnvConfigService, configService: ConfigService, systemRepo: SystemRepository);
    private getFromEmail;
    sendAlert(webhookUrl: string, measure: SutraMeasure, triggerReason: string): Promise<void>;
    sendUpdate(webhookUrl: string, title: string, description: string, details?: any): Promise<void>;
    processPendingNotifications(): Promise<void>;
    processWeeklyNotifications(): Promise<void>;
    private processNotifications;
    private sendEmailBatch;
    private markAsSent;
}
