import { OnModuleInit } from '@nestjs/common';
export declare class DatabaseMigrationService implements OnModuleInit {
    private readonly logger;
    onModuleInit(): Promise<void>;
    private runMigrations;
}
