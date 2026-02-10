import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SourceSnapshot } from '../entities';
import { DashboardImportController } from './dashboard-import.controller';
import { DashboardImportService } from './dashboard-import.service';
import { MockDashboardConnector, HttpDashboardConnector } from './connectors';
import { LawSourceConnector } from './interfaces';

/**
 * DashboardIntegrationModule
 * Handles integration with the Dashboard API for importing legal documents
 */
@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([SourceSnapshot]),
  ],
  controllers: [DashboardImportController],
  providers: [
    DashboardImportService,
    MockDashboardConnector,
    HttpDashboardConnector,
    {
      provide: 'LAW_SOURCE_CONNECTOR',
      useFactory: (
        configService: ConfigService,
        mockConnector: MockDashboardConnector,
        httpConnector: HttpDashboardConnector,
      ): LawSourceConnector => {
        const useMock = configService.get<string>('DASHBOARD_CONNECTOR_MODE') === 'mock';
        return useMock ? mockConnector : httpConnector;
      },
      inject: [ConfigService, MockDashboardConnector, HttpDashboardConnector],
    },
  ],
  exports: [DashboardImportService],
})
export class DashboardIntegrationModule {}
