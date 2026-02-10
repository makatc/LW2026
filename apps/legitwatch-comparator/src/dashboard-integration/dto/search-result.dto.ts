import { LawMetadataDto } from './law-metadata.dto';

export class SearchResultDto {
  items!: LawMetadataDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
