import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne,
  JoinColumn, Index,
} from 'typeorm';
import { DossierDocument } from './dossier-document.entity';
import { DossierProject } from './dossier-project.entity';

export enum ChunkType {
  EXPOSICION_DE_MOTIVOS = 'exposicion_de_motivos',
  ARTICULO = 'articulo',
  SECCION = 'seccion',
  INCISO = 'inciso',
  PONENCIA = 'ponencia',
  GENERAL = 'general',
}

// ARQUITECTURA: Se usa Gemini text-embedding-004 con 768 dimensiones.
// Ver docs/EMBEDDING_DECISION.md para la justificación completa.
// La columna embedding usa vector(768) compatible con pgvector y text-embedding-004.
@Entity('dossier_chunks')
@Index(['project_id'])
@Index(['document_id'])
export class DossierChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  document_id!: string;

  @ManyToOne(() => DossierDocument, (doc) => doc.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: DossierDocument;

  @Column({ type: 'uuid' })
  project_id!: string;

  @ManyToOne(() => DossierProject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: DossierProject;

  @Column({ type: 'integer' })
  chunk_index!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: ChunkType,
    default: ChunkType.GENERAL,
  })
  chunk_type!: ChunkType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  section_reference?: string;

  @Column({ type: 'integer', nullable: true })
  page_number?: number;

  // 768 dims for Gemini text-embedding-004
  @Column({ type: 'vector', length: 768, nullable: true })
  embedding?: number[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
