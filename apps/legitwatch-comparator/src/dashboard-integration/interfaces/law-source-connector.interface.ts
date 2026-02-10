import {
  LawMetadataDto,
  LawVersionDto,
  SearchResultDto,
} from '../dto';

/**
 * LawSourceConnector Interface
 * Defines the contract for fetching legal documents from external sources
 * (e.g., Dashboard API, Database, etc.)
 */
export interface LawSourceConnector {
  /**
   * Search for legal documents by query string
   * @param query Search term
   * @param page Page number (optional)
   * @param pageSize Items per page (optional)
   * @returns SearchResultDto with matching documents
   */
  search(
    query: string,
    page?: number,
    pageSize?: number,
  ): Promise<SearchResultDto>;

  /**
   * List all versions of a specific document
   * @param itemId Document identifier
   * @returns Array of version information
   */
  listVersions(itemId: string): Promise<LawVersionDto[]>;

  /**
   * Fetch the full text content of a specific version
   * @param versionId Version identifier
   * @returns The text content of the version
   */
  fetchVersionText(versionId: string): Promise<string>;

  /**
   * Fetch metadata for a specific document
   * @param itemId Document identifier
   * @returns Metadata including title, description, etc.
   */
  fetchMetadata(itemId: string): Promise<LawMetadataDto>;
}
