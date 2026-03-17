import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { DossierConversation } from './dossier-conversation.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface MessageCitation {
  chunk_id: string;
  document_name: string;
  section_reference?: string;
  page_number?: number;
}

@Entity('dossier_messages')
export class DossierMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @ManyToOne(() => DossierConversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: DossierConversation;

  @Column({ type: 'enum', enum: MessageRole })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  citations?: MessageCitation[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
