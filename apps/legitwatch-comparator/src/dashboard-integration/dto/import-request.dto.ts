import { IsString, IsOptional, IsArray } from 'class-validator';

export class ImportRequestDto {
  @IsString()
  itemId!: string;

  @IsString()
  @IsOptional()
  versionId?: string;
}

export class ImportMultipleRequestDto {
  @IsString()
  itemId!: string;

  @IsArray()
  @IsString({ each: true })
  versionIds!: string[];
}
