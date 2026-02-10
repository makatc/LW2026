import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { SourceSnapshot, SourceType } from '../entities';
import type { LawSourceConnector } from './interfaces';
import { LawVersionDto } from './dto';

export interface ImportResult {
  snapshotId: string;
  itemId: string;
  versionId: string;
  sha256Hash: string;
  isNew: boolean;
}

/**
 * DashboardImportService
 * Orchestrates the import of legal documents from the Dashboard
 * Uses the LawSourceConnector to fetch data and saves SourceSnapshots to the database
 */
@Injectable()
export class DashboardImportService {
  private readonly logger = new Logger(DashboardImportService.name);

  constructor(
    @Inject('LAW_SOURCE_CONNECTOR')
    private readonly connector: LawSourceConnector,
    @InjectRepository(SourceSnapshot)
    private readonly snapshotRepository: Repository<SourceSnapshot>,
  ) {}

  /**
   * Import a specific version from the dashboard
   * @param itemId Document ID
   * @param versionId Version ID (optional - if not provided, imports latest)
   * @returns ImportResult with snapshot information
   */
  async importFromDashboard(
    itemId: string,
    versionId?: string,
  ): Promise<ImportResult> {
    this.logger.log(`Starting import for item ${itemId}, version ${versionId || 'latest'}`);

    try {
      // Fetch metadata
      const metadata = await this.connector.fetchMetadata(itemId);
      this.logger.debug(`Fetched metadata: ${metadata.title}`);

      // If no versionId provided, get the latest version
      let targetVersion: LawVersionDto;
      if (!versionId) {
        const versions = await this.connector.listVersions(itemId);
        if (versions.length === 0) {
          throw new Error(`No versions found for item ${itemId}`);
        }
        // Get the latest version (assuming they're ordered by date)
        targetVersion = versions[versions.length - 1];
        versionId = targetVersion.id;
      } else {
        // Fetch the specific version
        const versions = await this.connector.listVersions(itemId);
        const found = versions.find((v) => v.id === versionId);
        if (!found) {
          throw new Error(`Version ${versionId} not found for item ${itemId}`);
        }
        targetVersion = found;
      }

      // Fetch the full text content
      const content = await this.connector.fetchVersionText(versionId);
      this.logger.debug(`Fetched content (${content.length} characters)`);

      // Calculate SHA256 hash
      const sha256Hash = this.calculateHash(content);

      // Check if snapshot already exists
      const existingSnapshot = await this.snapshotRepository.findOne({
        where: { sha256Hash },
      });

      if (existingSnapshot) {
        this.logger.log(`Snapshot already exists with hash ${sha256Hash}`);
        return {
          snapshotId: existingSnapshot.id,
          itemId,
          versionId,
          sha256Hash,
          isNew: false,
        };
      }

      // Determine source type (default to TEXT for now, can be enhanced)
      const sourceType = this.determineSourceType(targetVersion.sourceUrl);

      // Create new snapshot
      const snapshot = this.snapshotRepository.create({
        sourceType,
        sha256Hash,
        rawContent: content,
        sourceUrl: targetVersion.sourceUrl,
        originalFileName: `${metadata.title}_${targetVersion.versionTag}.txt`,
        fileSize: content.length,
        metadata: {
          itemId,
          versionId,
          title: metadata.title,
          versionTag: targetVersion.versionTag,
          author: metadata.author,
          publishedDate: targetVersion.publishedDate,
          dashboardMetadata: metadata.metadata,
        },
      });

      const savedSnapshot = await this.snapshotRepository.save(snapshot);
      this.logger.log(`Created new snapshot ${savedSnapshot.id}`);

      return {
        snapshotId: savedSnapshot.id,
        itemId,
        versionId,
        sha256Hash,
        isNew: true,
      };
    } catch (error) {
      this.logger.error(`Failed to import from dashboard: ${error}`);
      throw error;
    }
  }

  /**
   * Import multiple versions for comparison
   * @param itemId Document ID
   * @param versionIds Array of version IDs to import
   * @returns Array of ImportResults
   */
  async importMultipleVersions(
    itemId: string,
    versionIds: string[],
  ): Promise<ImportResult[]> {
    this.logger.log(`Importing ${versionIds.length} versions for item ${itemId}`);

    const results: ImportResult[] = [];
    for (const versionId of versionIds) {
      const result = await this.importFromDashboard(itemId, versionId);
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate SHA256 hash of content
   */
  private calculateHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Determine source type from URL or metadata
   */
  private determineSourceType(sourceUrl?: string): SourceType {
    if (!sourceUrl) {
      return SourceType.TEXT;
    }

    const lowerUrl = sourceUrl.toLowerCase();
    if (lowerUrl.endsWith('.pdf')) {
      return SourceType.PDF;
    }
    if (lowerUrl.endsWith('.docx') || lowerUrl.endsWith('.doc')) {
      return SourceType.DOCX;
    }
    if (lowerUrl.includes('html') || lowerUrl.startsWith('http')) {
      return SourceType.HTML;
    }

    return SourceType.TEXT;
  }
}
