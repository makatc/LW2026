import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFiscalIntelligencePhase61773200001000 implements MigrationInterface {
  name = 'AddFiscalIntelligencePhase61773200001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to dossier_documents
    await queryRunner.query(`
      ALTER TABLE dossier_documents
        ADD COLUMN IF NOT EXISTS auto_ingested BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS source VARCHAR(100),
        ADD COLUMN IF NOT EXISTS content_text TEXT,
        ADD COLUMN IF NOT EXISTS original_name VARCHAR(1000)
    `);

    // Extend the dossier_transformation_type enum with the new value
    await queryRunner.query(`
      ALTER TYPE dossier_transformation_type ADD VALUE IF NOT EXISTS 'analisis_riesgo_fomb'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removing enum values requires recreating the type; drop columns only
    await queryRunner.query(`
      ALTER TABLE dossier_documents
        DROP COLUMN IF EXISTS auto_ingested,
        DROP COLUMN IF EXISTS source,
        DROP COLUMN IF EXISTS content_text,
        DROP COLUMN IF EXISTS original_name
    `);
    // NOTE: removing an enum value requires a full type rebuild; omitted for safety
  }
}
