import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComparisonResults1707526900000 implements MigrationInterface {
  name = 'AddComparisonResults1707526900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "comparison_result_status_enum" AS ENUM('PROCESSING', 'COMPLETED', 'ERROR')
    `);

    await queryRunner.query(`
      CREATE TABLE "comparison_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sourceVersionId" uuid NOT NULL,
        "targetVersionId" uuid NOT NULL,
        "status" "comparison_result_status_enum" NOT NULL DEFAULT 'PROCESSING',
        "alignmentMap" jsonb NOT NULL DEFAULT '{}',
        "chunkComparisons" jsonb NOT NULL DEFAULT '[]',
        "summary" text,
        "impactScore" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comparison_results" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_comparison_results_versions"
      ON "comparison_results" ("sourceVersionId", "targetVersionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_comparison_results_versions"`);
    await queryRunner.query(`DROP TABLE "comparison_results"`);
    await queryRunner.query(`DROP TYPE "comparison_result_status_enum"`);
  }
}
