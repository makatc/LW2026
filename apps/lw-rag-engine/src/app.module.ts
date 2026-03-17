import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

import { ProjectsModule } from './modules/projects/projects.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { SearchModule } from './modules/search/search.module';
import { TransformationsModule } from './modules/transformations/transformations.module';

import {
  DossierProject,
  DossierDocument,
  DossierChunk,
  DossierConversation,
  DossierMessage,
  DossierTransformation,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL');
        const sslConfig = { rejectUnauthorized: false };
        const base = url
          ? { url, ssl: sslConfig, extra: { ssl: sslConfig } }
          : {
              host: configService.get('DB_HOST', 'localhost'),
              port: parseInt(configService.get('DB_PORT', '5433'), 10),
              username: configService.get('DB_USERNAME', 'postgres'),
              password: configService.get('DB_PASSWORD', 'password'),
              database: configService.get('DB_NAME', 'sutra_monitor'),
              ssl: configService.get('DB_SSL') === 'true' ? sslConfig : false,
            };
        return ({
        type: 'postgres' as const,
        ...base,
        entities: [
          DossierProject,
          DossierDocument,
          DossierChunk,
          DossierConversation,
          DossierMessage,
          DossierTransformation,
        ],
        synchronize: false,
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        migrationsRun: true,
        logging: configService.get('NODE_ENV') === 'development',
        });
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get('REDIS_PORT', '6380'), 10),
        },
      }),
      inject: [ConfigService],
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uploadDir = configService.get('UPLOAD_DIR', './uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        return {
          storage: diskStorage({
            destination: uploadDir,
            filename: (_req, file, cb) => {
              const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
              cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
            },
          }),
          limits: {
            fileSize: parseInt(configService.get('MAX_FILE_SIZE_MB', '50'), 10) * 1024 * 1024,
          },
        };
      },
      inject: [ConfigService],
    }),
    ProjectsModule,
    IngestionModule,
    SearchModule,
    TransformationsModule,
  ],
})
export class AppModule {}
