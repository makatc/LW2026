import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { DossierProject } from './dossier-project.entity';
import { DossierMessage } from './dossier-message.entity';

@Entity('dossier_conversations')
export class DossierConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @ManyToOne(() => DossierProject, (p) => p.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: DossierProject;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title?: string;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @OneToMany(() => DossierMessage, (msg) => msg.conversation, { cascade: true })
  messages!: DossierMessage[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
