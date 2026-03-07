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
  /** Base64-encoded original file bytes — used by Docling for native PDF parsing */
  fileBufferBase64?: string;
  /** Original file name with extension — used to detect MIME type for Docling */
  originalFileName?: string;
}

export interface IngestionJobResult {
  documentId: string;
  versionId: string;
  chunksCreated: number;
  processingTimeMs: number;
  success: boolean;
  error?: string;
}
