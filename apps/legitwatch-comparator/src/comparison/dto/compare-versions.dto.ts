import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CompareVersionsDto {
  @IsUUID()
  sourceVersionId!: string;

  @IsUUID()
  targetVersionId!: string;

  @IsBoolean()
  @IsOptional()
  detectSemanticChanges?: boolean;
}

export class ComparisonJobData {
  sourceVersionId!: string;
  targetVersionId!: string;
  detectSemanticChanges?: boolean;
}

export interface ComparisonJobResult {
  comparisonId: string;
  sourceVersionId: string;
  targetVersionId: string;
  chunksCompared: number;
  processingTimeMs: number;
  impactScore: number;
  success: boolean;
  error?: string;
}
