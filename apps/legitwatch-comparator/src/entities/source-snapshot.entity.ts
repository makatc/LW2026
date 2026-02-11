import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SourceType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  HTML = 'HTML',
  TEXT = 'TEXT',
  UPLOAD = 'UPLOAD',
}

@Entity('source_snapshots')
@Index(['sha256Hash'], { unique: true })
export class SourceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: SourceType,
  })
  sourceType!: SourceType;

  @Column({ type: 'varchar', length: 64 })
  sha256Hash!: string;

  @Column({ type: 'text' })
  rawContent!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  sourceUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
