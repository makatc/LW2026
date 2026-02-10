import { IsString, IsUUID, IsOptional } from 'class-validator';

export class IngestDocumentDto {
  @IsUUID()
  snapshotId!: string;

  @IsString()
  @IsOptional()
  versionTag?: string;
}

export class IngestionJobData {
  snapshotId!: string;
  versionTag?: string;
}

export interface IngestionJobResult {
  documentId: string;
  versionId: string;
  chunksCreated: number;
  processingTimeMs: number;
  success: boolean;
  error?: string;
}
