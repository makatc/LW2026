import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1707526800000 implements MigrationInterface {
  name = 'InitialSchema1707526800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create documents table
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(500) NOT NULL,
        "description" text,
        "documentType" character varying(100),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id")
      )
    `);

    // Create document_versions table
    await queryRunner.query(`
      CREATE TYPE "document_version_status_enum" AS ENUM('PROCESSING', 'READY', 'ERROR')
    `);

    await queryRunner.query(`
      CREATE TABLE "document_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "versionTag" character varying(255) NOT NULL,
        "status" "document_version_status_enum" NOT NULL DEFAULT 'PROCESSING',
        "normalizedText" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_versions" PRIMARY KEY ("id")
      )
    `);

    // Create document_chunks table
    await queryRunner.query(`
      CREATE TYPE "document_chunk_type_enum" AS ENUM('ARTICLE', 'SECTION', 'PARAGRAPH', 'CHAPTER')
    `);

    await queryRunner.query(`
      CREATE TABLE "document_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "versionId" uuid NOT NULL,
        "type" "document_chunk_type_enum" NOT NULL,
        "label" character varying(255) NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1536),
        "orderIndex" integer NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_chunks" PRIMARY KEY ("id")
      )
    `);

    // Create source_snapshots table
    await queryRunner.query(`
      CREATE TYPE "source_snapshot_type_enum" AS ENUM('PDF', 'DOCX', 'HTML', 'TEXT')
    `);

    await queryRunner.query(`
      CREATE TABLE "source_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sourceType" "source_snapshot_type_enum" NOT NULL,
        "sha256Hash" character varying(64) NOT NULL,
        "rawContent" text NOT NULL,
        "sourceUrl" character varying(500),
        "originalFileName" character varying(255),
        "fileSize" bigint,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_source_snapshots" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_document_chunks_versionId_orderIndex"
      ON "document_chunks" ("versionId", "orderIndex")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_source_snapshots_sha256Hash"
      ON "source_snapshots" ("sha256Hash")
    `);

    // Create foreign keys
    await queryRunner.query(`
      ALTER TABLE "document_versions"
      ADD CONSTRAINT "FK_document_versions_documentId"
      FOREIGN KEY ("documentId") REFERENCES "documents"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "document_chunks"
      ADD CONSTRAINT "FK_document_chunks_versionId"
      FOREIGN KEY ("versionId") REFERENCES "document_versions"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "document_chunks" DROP CONSTRAINT "FK_document_chunks_versionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_versions" DROP CONSTRAINT "FK_document_versions_documentId"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "IDX_source_snapshots_sha256Hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_document_chunks_versionId_orderIndex"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "source_snapshots"`);
    await queryRunner.query(`DROP TABLE "document_chunks"`);
    await queryRunner.query(`DROP TABLE "document_versions"`);
    await queryRunner.query(`DROP TABLE "documents"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "source_snapshot_type_enum"`);
    await queryRunner.query(`DROP TYPE "document_chunk_type_enum"`);
    await queryRunner.query(`DROP TYPE "document_version_status_enum"`);
  }
}
