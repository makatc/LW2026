export class LawVersionDto {
  id!: string;
  documentId!: string;
  versionTag!: string;
  content!: string;
  sourceUrl?: string;
  publishedDate?: Date;
  metadata?: Record<string, any>;
}
