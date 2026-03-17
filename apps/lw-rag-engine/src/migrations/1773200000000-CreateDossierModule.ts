import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDossierModule1773200000000 implements MigrationInterface {
  name = 'CreateDossierModule1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgvector extension is available
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE dossier_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(500) NOT NULL,
        description TEXT,
        measure_reference VARCHAR(50),
        organization_id UUID,
        created_by UUID,
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE dossier_document_status AS ENUM ('pending', 'processing', 'completed', 'error')
    `);

    await queryRunner.query(`
      CREATE TABLE dossier_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES dossier_projects(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        processing_status dossier_document_status NOT NULL DEFAULT 'pending',
        processing_error TEXT,
        chunk_count INTEGER DEFAULT 0,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TYPE dossier_chunk_type AS ENUM ('exposicion_de_motivos', 'articulo', 'seccion', 'inciso', 'ponencia', 'general')
    `);

    await queryRunner.query(`
      CREATE TABLE dossier_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES dossier_documents(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES dossier_projects(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        chunk_type dossier_chunk_type NOT NULL DEFAULT 'general',
        section_reference VARCHAR(255),
        page_number INTEGER,
        embedding vector(768),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // HNSW index for fast cosine similarity search
    await queryRunner.query(`
      CREATE INDEX dossier_chunks_embedding_idx ON dossier_chunks
      USING hnsw (embedding vector_cosine_ops)
    `);

    await queryRunner.query(`CREATE INDEX dossier_chunks_project_idx ON dossier_chunks(project_id)`);
    await queryRunner.query(`CREATE INDEX dossier_chunks_document_idx ON dossier_chunks(document_id)`);

    // Full-text search index for hybrid search (Spanish)
    await queryRunner.query(`
      ALTER TABLE dossier_chunks ADD COLUMN search_vector TSVECTOR
        GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX dossier_chunks_fts_idx ON dossier_chunks USING GIN(search_vector)
    `);

    await queryRunner.query(`
      CREATE TABLE dossier_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES dossier_projects(id) ON DELETE CASCADE,
        title VARCHAR(500),
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE dossier_message_role AS ENUM ('user', 'assistant')
    `);

    await queryRunner.query(`
      CREATE TABLE dossier_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES dossier_conversations(id) ON DELETE CASCADE,
        role dossier_message_role NOT NULL,
        content TEXT NOT NULL,
        citations JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX dossier_messages_conv_idx ON dossier_messages(conversation_id, created_at)`);

    await queryRunner.query(`
      CREATE TYPE dossier_transformation_type AS ENUM (
        'memorial_explicativo', 'carta_legislador', 'talking_points',
        'testimonio', 'resumen_ejecutivo', 'personalizado'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE dossier_client_stance AS ENUM ('apoyo', 'oposicion', 'apoyo_con_enmiendas', 'neutral')
    `);

    await queryRunner.query(`
      CREATE TYPE dossier_generation_status AS ENUM ('pending', 'generating', 'completed', 'error')
    `);

    await queryRunner.query(`
      CREATE TABLE dossier_transformations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES dossier_projects(id) ON DELETE CASCADE,
        transformation_type dossier_transformation_type NOT NULL,
        title VARCHAR(500) NOT NULL,
        legislator_id UUID,
        client_stance dossier_client_stance NOT NULL,
        tone_profile VARCHAR(100),
        selected_chunk_ids JSONB NOT NULL DEFAULT '[]',
        custom_instructions TEXT,
        generated_content TEXT,
        generation_status dossier_generation_status NOT NULL DEFAULT 'pending',
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX dossier_transformations_project_idx ON dossier_transformations(project_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_transformations`);
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_chunks`);
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_projects`);
    await queryRunner.query(`DROP TYPE IF EXISTS dossier_generation_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS dossier_client_stance`);
    await queryRunner.query(`DROP TYPE IF EXISTS dossier_transformation_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS dossier_message_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS dossier_chunk_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS dossier_document_status`);
  }
}
