import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DashboardImportService, ImportResult } from './dashboard-import.service';
import { ImportRequestDto, ImportMultipleRequestDto } from './dto/import-request.dto';

/**
 * DashboardImportController
 * Handles HTTP endpoints for importing legal documents from the Dashboard
 */
@Controller('import/dashboard')
export class DashboardImportController {
  private readonly logger = new Logger(DashboardImportController.name);

  constructor(
    private readonly importService: DashboardImportService,
  ) {}

  /**
   * Import a single version from the dashboard
   * POST /import/dashboard
   * @param body ImportRequestDto with itemId and optional versionId
   * @returns ImportResult with snapshot information
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async importDocument(
    @Body() body: ImportRequestDto,
  ): Promise<ImportResult> {
    this.logger.log(`Import request received for item ${body.itemId}`);

    try {
      const result = await this.importService.importFromDashboard(
        body.itemId,
        body.versionId,
      );

      this.logger.log(
        `Import completed: snapshot ${result.snapshotId}, isNew: ${result.isNew}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Import failed: ${error}`);
      throw error;
    }
  }

  /**
   * Import multiple versions from the dashboard for comparison
   * POST /import/dashboard/multiple
   * @param body ImportMultipleRequestDto with itemId and versionIds array
   * @returns Array of ImportResults
   */
  @Post('multiple')
  @HttpCode(HttpStatus.OK)
  async importMultipleVersions(
    @Body() body: ImportMultipleRequestDto,
  ): Promise<ImportResult[]> {
    this.logger.log(
      `Multiple import request received for item ${body.itemId}, versions: ${body.versionIds.join(', ')}`,
    );

    try {
      const results = await this.importService.importMultipleVersions(
        body.itemId,
        body.versionIds,
      );

      this.logger.log(`Multiple import completed: ${results.length} snapshots`);

      return results;
    } catch (error) {
      this.logger.error(`Multiple import failed: ${error}`);
      throw error;
    }
  }
}
