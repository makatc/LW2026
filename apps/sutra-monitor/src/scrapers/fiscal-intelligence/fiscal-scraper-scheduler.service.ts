import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OgpScraper } from './ogp.scraper';
import { HaciendaScraper } from './hacienda.scraper';
import { FombScraper } from './fomb.scraper';
import { pool } from '@lwbeta/db';

@Injectable()
export class FiscalScraperSchedulerService {
  private readonly logger = new Logger(FiscalScraperSchedulerService.name);

  constructor(
    private readonly ogpScraper: OgpScraper,
    private readonly haciendaScraper: HaciendaScraper,
    private readonly fombScraper: FombScraper,
  ) {}

  private async isEnabled(id: string): Promise<boolean> {
    try {
      const result = await pool.query('SELECT is_enabled FROM scraper_configs WHERE id = $1', [id]);
      return result.rows[0]?.is_enabled ?? true;
    } catch {
      return true; // default enabled if DB unreachable
    }
  }

  // OGP: every 6 hours at :00
  @Cron('0 0,6,12,18 * * *', { name: 'fiscal-ogp-cron' })
  async runOgpScraper() {
    if (!(await this.isEnabled('ogp'))) { this.logger.debug('OGP scraper disabled, skipping'); return; }
    this.logger.log('Running OGP fiscal scraper...');
    try {
      const notes = await this.ogpScraper.scrape();
      const { newCount, updatedCount } = await this.ogpScraper.upsertNotes(notes);
      this.logger.log(`OGP: ${newCount} new, ${updatedCount} updated`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OGP scraper run failed: ${msg}`);
    }
  }

  // Hacienda: every 6 hours, offset 3 hours from OGP
  @Cron('0 3,9,15,21 * * *', { name: 'fiscal-hacienda-cron' })
  async runHaciendaScraper() {
    if (!(await this.isEnabled('hacienda'))) { this.logger.debug('Hacienda scraper disabled, skipping'); return; }
    this.logger.log('Running Hacienda fiscal scraper...');
    try {
      const notes = await this.haciendaScraper.scrape();
      const { newCount, updatedCount } = await this.haciendaScraper.upsertNotes(notes);
      this.logger.log(`Hacienda: ${newCount} new, ${updatedCount} updated`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Hacienda scraper run failed: ${msg}`);
    }
  }

  // FOMB: every 4 hours (more urgent)
  @Cron('0 */4 * * *', { name: 'fiscal-fomb-cron' })
  async runFombScraper() {
    if (!(await this.isEnabled('fomb'))) { this.logger.debug('FOMB scraper disabled, skipping'); return; }
    this.logger.log('Running FOMB scraper...');
    try {
      const actions = await this.fombScraper.scrape();
      const { newCount, updatedCount } = await this.fombScraper.upsertActions(actions);
      this.logger.log(`FOMB: ${newCount} new, ${updatedCount} updated`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`FOMB scraper run failed: ${msg}`);
    }
  }

  // Manual trigger for testing
  async triggerAll() {
    await Promise.allSettled([
      this.runOgpScraper(),
      this.runHaciendaScraper(),
      this.runFombScraper(),
    ]);
  }
}
