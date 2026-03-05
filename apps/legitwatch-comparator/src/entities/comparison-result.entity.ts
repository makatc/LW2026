import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ComparisonStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

@Entity('comparison_results')
@Index(['sourceVersionId', 'targetVersionId'])
export class ComparisonResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sourceVersionId!: string;

  @Column({ type: 'uuid' })
  targetVersionId!: string;

  @Column({
    type: 'enum',
    enum: ComparisonStatus,
    default: ComparisonStatus.PROCESSING,
  })
  status!: ComparisonStatus;

  @Column({ type: 'jsonb', default: {} })
  alignmentMap!: Record<string, string>;

  @Column({ type: 'jsonb', default: [] })
  chunkComparisons!: Array<{
    sourceChunkId: string;
    targetChunkId: string;
    label?: string;
    diffHtml: string;
    sourceSideHtml?: string;
    targetSideHtml?: string;
    changeType?: string;
    impactScore?: number;
  }>;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'integer', default: 0 })
  impactScore!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
