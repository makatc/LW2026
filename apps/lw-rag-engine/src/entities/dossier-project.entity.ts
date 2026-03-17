import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DossierDocument } from './dossier-document.entity';
import { DossierConversation } from './dossier-conversation.entity';
import { DossierTransformation } from './dossier-transformation.entity';

@Entity('dossier_projects')
export class DossierProject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  measure_reference?: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id?: string;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @Column({ type: 'boolean', default: false })
  deleted!: boolean;

  @OneToMany(() => DossierDocument, (doc) => doc.project)
  documents!: DossierDocument[];

  @OneToMany(() => DossierConversation, (conv) => conv.project)
  conversations!: DossierConversation[];

  @OneToMany(() => DossierTransformation, (t) => t.project)
  transformations!: DossierTransformation[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
