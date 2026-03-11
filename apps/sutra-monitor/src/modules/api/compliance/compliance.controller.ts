import { Controller, Get, Query, Res, StreamableFile, Header } from '@nestjs/common';
import { Public } from '../../auth/decorators';
import { ComplianceReportService } from './compliance-report.service';
import { CompliancePdfService } from './compliance-pdf.service';
import type { Response } from 'express';

@Controller('api/compliance')
@Public()
export class ComplianceController {
    constructor(
        private readonly reportService: ComplianceReportService,
        private readonly pdfService: CompliancePdfService,
    ) {}

    /**
     * GET /api/compliance/report
     * Returns structured compliance data for a semester.
     * Query params: year (default: current), semester (1 or 2, default: current)
     */
    @Get('report')
    async getReport(
        @Query('year') year?: string,
        @Query('semester') semester?: string,
        @Query('organization_id') organizationId?: string,
    ) {
        const y = year ? parseInt(year, 10) : new Date().getFullYear();
        const s = semester ? parseInt(semester, 10) : (new Date().getMonth() < 6 ? 1 : 2);
        return this.reportService.generateReport(y, s as 1 | 2, organizationId);
    }

    /**
     * GET /api/compliance/report/pdf
     * Downloads PDF in the DOJ Ley 118-2003 format.
     */
    @Get('report/pdf')
    async downloadPdf(
        @Query('year') year?: string,
        @Query('semester') semester?: string,
        @Query('organization_id') organizationId?: string,
        @Res() res?: Response,
    ) {
        const y = year ? parseInt(year, 10) : new Date().getFullYear();
        const s = semester ? parseInt(semester, 10) : (new Date().getMonth() < 6 ? 1 : 2);

        const reportData = await this.reportService.generateReport(y, s as 1 | 2, organizationId);
        const pdfBuffer = await this.pdfService.generatePdf(reportData);

        const filename = `reporte_compliance_${y}_S${s}.pdf`;
        res!.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
        });
        res!.end(pdfBuffer);
    }

    /**
     * GET /api/compliance/summary
     * Quick summary: total interactions this semester, by type, by legislator.
     */
    @Get('summary')
    async getSummary(
        @Query('year') year?: string,
        @Query('semester') semester?: string,
    ) {
        const y = year ? parseInt(year, 10) : new Date().getFullYear();
        const s = semester ? parseInt(semester, 10) : (new Date().getMonth() < 6 ? 1 : 2);
        return this.reportService.getSummary(y, s as 1 | 2);
    }
}
