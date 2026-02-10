import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { DocumentChunk } from './document-chunk.entity';

export enum DocumentVersionStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
}

@Entity('document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => Document, (document) => document.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @Column({ type: 'varchar', length: 255 })
  versionTag!: string;

  @Column({
    type: 'enum',
    enum: DocumentVersionStatus,
    default: DocumentVersionStatus.PROCESSING,
  })
  status!: DocumentVersionStatus;

  @Column({ type: 'text', nullable: true })
  normalizedText?: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @OneToMany(() => DocumentChunk, (chunk) => chunk.version, {
    cascade: true,
  })
  chunks!: DocumentChunk[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
