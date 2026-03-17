import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne,
  JoinColumn, OneToMany,
} from 'typeorm';
import { DossierProject } from './dossier-project.entity';
import { DossierChunk } from './dossier-chunk.entity';

export enum DocumentProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

@Entity('dossier_documents')
export class DossierDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @ManyToOne(() => DossierProject, (p) => p.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: DossierProject;

  @Column({ type: 'varchar', length: 500 })
  file_name!: string;

  @Column({ type: 'varchar', length: 1000 })
  file_path!: string;

  @Column({ type: 'integer' })
  file_size!: number;

  @Column({ type: 'varchar', length: 100 })
  mime_type!: string;

  @Column({
    type: 'enum',
    enum: DocumentProcessingStatus,
    default: DocumentProcessingStatus.PENDING,
  })
  processing_status!: DocumentProcessingStatus;

  @Column({ type: 'text', nullable: true })
  processing_error?: string;

  @Column({ type: 'integer', default: 0 })
  chunk_count!: number;

  @OneToMany(() => DossierChunk, (chunk) => chunk.document)
  chunks!: DossierChunk[];

  @CreateDateColumn({ type: 'timestamptz' })
  uploaded_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at?: Date;
}
