/**
 * LobbyistRegistryScraperService
 *
 * FUENTE: registrodecabilderos.pr.gov — Registro Público del Departamento de
 *         Justicia de Puerto Rico.
 * Verificado: 2026-03-17
 *
 * IMPORTANTE: Si el scraper falla por cambio en el portal, loggear con warn,
 *             NUNCA lanzar hacia arriba. El job sigue ejecutándose la próxima
 *             semana con los datos que tenga.
 *
 * Dependencias: axios, cheerio (ambas presentes en package.json)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { DatabaseService } from '../database/database.service';

// ─── Internal types ──────────────────────────────────────────────────────────

interface ScrapedLobbyist {
  registration_number: string;
  name: string;
  firm_name: string | null;
  represented_clients: string[];
  sectors: string[];
  source_url: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LobbyistRegistryScraperService {
  private readonly logger = new Logger(LobbyistRegistryScraperService.name);

  /**
   * The base URL for the public lobbyist registry.
   * If the portal is restructured the URL will need to be updated here.
   */
  private readonly BASE_URL =
    'https://registrodecabilderos.pr.gov/public/lobbyists';

  constructor(private readonly db: DatabaseService) {}

  // ─── Cron ─────────────────────────────────────────────────────────────────

  /**
   * Weekly sync: Sunday 03:00 AM PR time (07:00 AM UTC).
   * @Cron uses UTC by default; timeZone overrides to PR local time.
   */
  @Cron('0 7 * * 0', { timeZone: 'America/Puerto_Rico' })
  async syncLobbyistRegistry(): Promise<void> {
    this.logger.log('Starting weekly lobbyist registry sync...');
    try {
      const { synced, errors } = await this.scrapeAndSync();
      this.logger.log(
        `Lobbyist registry sync complete — synced: ${synced}, errors: ${errors}`,
      );
    } catch (err) {
      // Never propagate — log and swallow so the cron scheduler stays healthy
      this.logger.warn(
        'Lobbyist registry sync failed unexpectedly (portal may have changed):',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Scrapes the public registry and upserts into the registered_lobbyists
   * table. Returns a summary of results.
   *
   * NOTE: CSS selectors are based on the portal structure as of 2026-03-17.
   *       The portal may change its markup at any time — if so, update the
   *       selectors below and re-verify before the next cron run.
   */
  async scrapeAndSync(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    let lobbyists: ScrapedLobbyist[] = [];

    try {
      lobbyists = await this.fetchAllPages();
    } catch (err) {
      this.logger.warn(
        'Failed to fetch lobbyist registry pages — portal may have changed:',
        err instanceof Error ? err.message : String(err),
      );
      return { synced: 0, errors: 1 };
    }

    for (const lobbyist of lobbyists) {
      try {
        await this.upsertLobbyist(lobbyist);
        synced++;
      } catch (err) {
        errors++;
        this.logger.warn(
          `Failed to upsert lobbyist "${lobbyist.name}" (${lobbyist.registration_number}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return { synced, errors };
  }

  // ─── Scraping internals ──────────────────────────────────────────────────

  /**
   * Iterates over all paginated pages of the public registry.
   *
   * The portal uses a ?page=N query parameter for pagination.
   * Selectors verified against the portal as of 2026-03-17 — may need
   * updating if the portal is redesigned.
   */
  private async fetchAllPages(): Promise<ScrapedLobbyist[]> {
    const all: ScrapedLobbyist[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${this.BASE_URL}?page=${page}`;
      let html: string;

      try {
        const response = await axios.get<string>(url, {
          timeout: 30_000,
          headers: {
            'User-Agent':
              'LegalWatch-Monitor/1.0 (gov data scraper; contact: admin@legalwatch.pr)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
        html = response.data;
      } catch (err) {
        this.logger.warn(
          `HTTP error fetching page ${page} from ${url}:`,
          err instanceof Error ? err.message : String(err),
        );
        break;
      }

      const parsed = this.parsePage(html, url);

      if (parsed.length === 0) {
        // Empty page means we've exhausted pagination
        hasMore = false;
      } else {
        all.push(...parsed);
        page++;

        // Safety valve: stop after 200 pages to avoid infinite loops
        if (page > 200) {
          this.logger.warn(
            'Reached page limit (200) during lobbyist registry scrape — stopping.',
          );
          hasMore = false;
        }
      }
    }

    return all;
  }

  /**
   * Parses a single HTML page from the lobbyist registry.
   *
   * Expected markup (as of 2026-03-17):
   *   <table class="lobbyist-table">
   *     <tbody>
   *       <tr>
   *         <td class="reg-number">L-2024-001</td>
   *         <td class="lobbyist-name">Nombre Apellido</td>
   *         <td class="firm-name">Firma LLC</td>
   *         <td class="clients">Cliente A, Cliente B</td>
   *         <td class="sectors">Salud, Energía</td>
   *       </tr>
   *       ...
   *     </tbody>
   *   </table>
   *
   * If the portal changes its markup, update the selectors here.
   */
  private parsePage(html: string, pageUrl: string): ScrapedLobbyist[] {
    const $ = cheerio.load(html);
    const results: ScrapedLobbyist[] = [];

    // Primary selector: table with class lobbyist-table
    const rows = $('table.lobbyist-table tbody tr, table#lobbyists tbody tr');

    rows.each((_i, el) => {
      const cells = $(el).find('td');
      if (cells.length < 2) return; // Skip malformed rows

      // Try class-based selectors first, fall back to positional
      const regNumber =
        $(el).find('td.reg-number').text().trim() ||
        cells.eq(0).text().trim();

      const name =
        $(el).find('td.lobbyist-name').text().trim() ||
        cells.eq(1).text().trim();

      const firmName =
        $(el).find('td.firm-name').text().trim() ||
        cells.eq(2).text().trim() ||
        null;

      const clientsRaw =
        $(el).find('td.clients').text().trim() ||
        cells.eq(3).text().trim();

      const sectorsRaw =
        $(el).find('td.sectors').text().trim() ||
        cells.eq(4).text().trim();

      if (!regNumber || !name) return; // Skip rows without required fields

      const represented_clients = clientsRaw
        ? clientsRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : [];

      const sectors = sectorsRaw
        ? sectorsRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : [];

      results.push({
        registration_number: regNumber,
        name,
        firm_name: firmName || null,
        represented_clients,
        sectors,
        source_url: pageUrl,
      });
    });

    return results;
  }

  // ─── Database ────────────────────────────────────────────────────────────

  private async upsertLobbyist(lobbyist: ScrapedLobbyist): Promise<void> {
    await this.db.query(
      `INSERT INTO registered_lobbyists
         (registration_number, name, firm_name, represented_clients, sectors,
          source_url, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (registration_number) DO UPDATE SET
         name                = EXCLUDED.name,
         firm_name           = EXCLUDED.firm_name,
         represented_clients = EXCLUDED.represented_clients,
         sectors             = EXCLUDED.sectors,
         source_url          = EXCLUDED.source_url,
         last_synced_at      = NOW(),
         updated_at          = NOW()`,
      [
        lobbyist.registration_number,
        lobbyist.name,
        lobbyist.firm_name,
        JSON.stringify(lobbyist.represented_clients),
        JSON.stringify(lobbyist.sectors),
        lobbyist.source_url,
      ],
    );
  }
}
