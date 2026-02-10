import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DocumentVersion } from './document-version.entity';

export enum DocumentChunkType {
  ARTICLE = 'ARTICLE',
  SECTION = 'SECTION',
  PARAGRAPH = 'PARAGRAPH',
  CHAPTER = 'CHAPTER',
}

@Entity('document_chunks')
@Index(['versionId', 'orderIndex'])
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  versionId!: string;

  @ManyToOne(() => DocumentVersion, (version) => version.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'versionId' })
  version!: DocumentVersion;

  @Column({
    type: 'enum',
    enum: DocumentChunkType,
  })
  type!: DocumentChunkType;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'vector',
    length: 1536,
    nullable: true,
  })
  embedding?: number[];

  @Column({ type: 'integer' })
  orderIndex!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
