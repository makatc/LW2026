import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceReportService } from './compliance-report.service';
import { CompliancePdfService } from './compliance-pdf.service';

@Module({
    imports: [DatabaseModule],
    controllers: [ComplianceController],
    providers: [ComplianceReportService, CompliancePdfService],
    exports: [ComplianceReportService],
})
export class ComplianceModule {}
