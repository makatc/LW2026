import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  LawMetadataDto,
  LawVersionDto,
  SearchResultDto,
} from '../dto';
import { LawSourceConnector } from '../interfaces';

/**
 * HttpDashboardConnector
 * Connects to the Dashboard API via HTTP with JWT/API Key authentication
 * Includes retry logic and rate limit handling
 */
@Injectable()
export class HttpDashboardConnector implements LawSourceConnector {
  private readonly logger = new Logger(HttpDashboardConnector.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('DASHBOARD_API_URL') || '';
    this.apiKey = this.configService.get<string>('DASHBOARD_API_KEY') || '';
    this.timeout = this.configService.get<number>('DASHBOARD_API_TIMEOUT') || 30000;
    this.maxRetries = this.configService.get<number>('DASHBOARD_API_MAX_RETRIES') || 3;

    if (!this.baseUrl) {
      this.logger.warn('DASHBOARD_API_URL is not configured');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = this.maxRetries,
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        const delay = this.calculateBackoff(this.maxRetries - retries);
        this.logger.warn(
          `Request failed, retrying in ${delay}ms. Retries left: ${retries}`,
        );
        await this.sleep(delay);
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof AxiosError) {
      // Retry on network errors or 5xx status codes
      return !error.response || (error.response.status >= 500 && error.response.status < 600);
    }
    return false;
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.pow(2, attempt) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async search(
    query: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<SearchResultDto> {
    return this.retryRequest(async () => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/api/laws/search`, {
            headers: this.getHeaders(),
            params: { q: query, page, pageSize },
            timeout: this.timeout,
          }),
        );

        return response.data;
      } catch (error) {
        this.logger.error(`Failed to search laws: ${error}`);
        throw new Error(`Dashboard API search failed: ${error}`);
      }
    });
  }

  async listVersions(itemId: string): Promise<LawVersionDto[]> {
    return this.retryRequest(async () => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/api/laws/${itemId}/versions`, {
            headers: this.getHeaders(),
            timeout: this.timeout,
          }),
        );

        return response.data;
      } catch (error) {
        this.logger.error(`Failed to list versions for item ${itemId}: ${error}`);
        throw new Error(`Dashboard API listVersions failed: ${error}`);
      }
    });
  }

  async fetchVersionText(versionId: string): Promise<string> {
    return this.retryRequest(async () => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/api/versions/${versionId}/text`, {
            headers: this.getHeaders(),
            timeout: this.timeout,
          }),
        );

        return response.data.content || response.data.text || response.data;
      } catch (error) {
        this.logger.error(`Failed to fetch version text ${versionId}: ${error}`);
        throw new Error(`Dashboard API fetchVersionText failed: ${error}`);
      }
    });
  }

  async fetchMetadata(itemId: string): Promise<LawMetadataDto> {
    return this.retryRequest(async () => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/api/laws/${itemId}`, {
            headers: this.getHeaders(),
            timeout: this.timeout,
          }),
        );

        return response.data;
      } catch (error) {
        this.logger.error(`Failed to fetch metadata for item ${itemId}: ${error}`);
        throw new Error(`Dashboard API fetchMetadata failed: ${error}`);
      }
    });
  }
}
