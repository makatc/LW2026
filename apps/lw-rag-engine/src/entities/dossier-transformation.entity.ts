import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { DossierProject } from './dossier-project.entity';

export enum TransformationType {
  MEMORIAL_EXPLICATIVO = 'memorial_explicativo',
  CARTA_LEGISLADOR = 'carta_legislador',
  TALKING_POINTS = 'talking_points',
  TESTIMONIO = 'testimonio',
  RESUMEN_EJECUTIVO = 'resumen_ejecutivo',
  PERSONALIZADO = 'personalizado',
}

export enum ClientStance {
  APOYO = 'apoyo',
  OPOSICION = 'oposicion',
  APOYO_CON_ENMIENDAS = 'apoyo_con_enmiendas',
  NEUTRAL = 'neutral',
}

export enum GenerationStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  ERROR = 'error',
}

@Entity('dossier_transformations')
export class DossierTransformation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @ManyToOne(() => DossierProject, (p) => p.transformations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: DossierProject;

  @Column({ type: 'enum', enum: TransformationType })
  transformation_type!: TransformationType;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'uuid', nullable: true })
  legislator_id?: string;

  @Column({ type: 'enum', enum: ClientStance })
  client_stance!: ClientStance;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tone_profile?: string;

  @Column({ type: 'jsonb', default: [] })
  selected_chunk_ids!: string[];

  @Column({ type: 'text', nullable: true })
  custom_instructions?: string;

  @Column({ type: 'text', nullable: true })
  generated_content?: string;

  @Column({ type: 'enum', enum: GenerationStatus, default: GenerationStatus.PENDING })
  generation_status!: GenerationStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
