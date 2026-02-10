export class LawMetadataDto {
  id!: string;
  title!: string;
  description?: string;
  documentType?: string;
  sourceUrl?: string;
  author?: string;
  publishedDate?: Date;
  metadata?: Record<string, any>;
}
