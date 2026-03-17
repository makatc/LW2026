import { Controller, Get, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { FiscalContextService, FiscalContextAvailability, FiscalContextInjectResult } from './fiscal-context.service';

@Controller('projects')
export class FiscalContextController {
  constructor(private readonly fiscalContextService: FiscalContextService) {}

  /**
   * GET /projects/:id/fiscal-context-available
   * Returns the count of available fiscal notes and FOMB actions for the project's measure_reference.
   */
  @Get(':id/fiscal-context-available')
  async getFiscalContextAvailable(
    @Param('id') id: string,
  ): Promise<FiscalContextAvailability> {
    return this.fiscalContextService.getFiscalContextAvailable(id);
  }

  /**
   * POST /projects/:id/fiscal-context
   * Triggers auto-ingestion of fiscal notes and FOMB actions as dossier documents.
   */
  @Post(':id/fiscal-context')
  @HttpCode(HttpStatus.OK)
  async injectFiscalContext(
    @Param('id') id: string,
  ): Promise<FiscalContextInjectResult> {
    return this.fiscalContextService.injectFiscalContext(id);
  }
}
