import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// ─── Domain interfaces ──────────────────────────────────────────────────────

export interface Coalition {
  id: string;
  name: string;
  bill_id: string;
  created_by: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CoalitionMember {
  id: string;
  coalition_id: string;
  organization_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  stance: 'support' | 'opposition' | 'neutral' | 'undecided';
  last_contact_date?: Date;
  notes?: string;
}

export interface CoalitionCommitment {
  id: string;
  coalition_id: string;
  coalition_member_id: string;
  description: string;
  due_date?: Date;
  status: 'pending' | 'completed' | 'cancelled';
  completed_at?: Date;
}

export interface CoalitionMessage {
  id: string;
  coalition_id: string;
  author_user_id: string;
  content: string;
  message_type: 'note' | 'agreed_argument' | 'task_update' | 'general';
  created_at: Date;
}

export type CoalitionDetail = Coalition & {
  members: CoalitionMember[];
  commitments: CoalitionCommitment[];
  messages: CoalitionMessage[];
};

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateCoalitionDto {
  name: string;
  bill_id: string;
}

export interface AddMemberDto {
  organization_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  stance?: 'support' | 'opposition' | 'neutral' | 'undecided';
  last_contact_date?: Date;
  notes?: string;
}

export interface AddCommitmentDto {
  coalition_member_id: string;
  description: string;
  due_date?: Date;
  status?: 'pending' | 'completed' | 'cancelled';
  completed_at?: Date;
}

export interface AddMessageDto {
  content: string;
  message_type: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class CoalitionsService {
  private readonly logger = new Logger(CoalitionsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Fetches a coalition row and throws NotFoundException if absent. */
  private async fetchCoalition(id: string): Promise<Coalition> {
    const res = await this.db.query(
      `SELECT id, name, bill_id, created_by, is_active, created_at, updated_at
       FROM coalitions
       WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Coalition ${id} not found`);
    }
    return res.rows[0] as Coalition;
  }

  /**
   * Ensures the coalition exists AND that the requesting user owns it.
   * Returns the coalition row on success.
   */
  private async authorizeOwner(
    id: string,
    userId: string,
  ): Promise<Coalition> {
    const coalition = await this.fetchCoalition(id);
    if (coalition.created_by !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this coalition',
      );
    }
    return coalition;
  }

  // ─── Coalition CRUD ─────────────────────────────────────────────────────

  /**
   * Returns all active coalitions owned by userId, including aggregated
   * member count and pending commitment count.
   */
  async getCoalitions(userId: string): Promise<
    (Coalition & { member_count: number; pending_commitment_count: number })[]
  > {
    const res = await this.db.query(
      `SELECT c.id, c.name, c.bill_id, c.created_by, c.is_active,
              c.created_at, c.updated_at,
              COUNT(DISTINCT cm.id)::int                                       AS member_count,
              COUNT(DISTINCT cc.id) FILTER (WHERE cc.status = 'pending')::int AS pending_commitment_count
       FROM coalitions c
       LEFT JOIN coalition_members cm     ON cm.coalition_id = c.id
       LEFT JOIN coalition_commitments cc ON cc.coalition_id = c.id
       WHERE c.created_by = $1
         AND c.is_active = true
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [userId],
    );
    return res.rows;
  }

  async createCoalition(
    userId: string,
    dto: CreateCoalitionDto,
  ): Promise<Coalition> {
    const res = await this.db.query(
      `INSERT INTO coalitions (name, bill_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, bill_id, created_by, is_active, created_at, updated_at`,
      [dto.name, dto.bill_id, userId],
    );
    return res.rows[0] as Coalition;
  }

  async getCoalitionById(
    id: string,
    userId: string,
  ): Promise<CoalitionDetail> {
    const coalition = await this.authorizeOwner(id, userId);

    const [membersRes, commitmentsRes, messagesRes] = await Promise.all([
      this.db.query(
        `SELECT id, coalition_id, organization_name, contact_name, contact_email,
                contact_phone, stance, last_contact_date, notes
         FROM coalition_members
         WHERE coalition_id = $1
         ORDER BY organization_name`,
        [id],
      ),
      this.db.query(
        `SELECT id, coalition_id, coalition_member_id, description,
                due_date, status, completed_at
         FROM coalition_commitments
         WHERE coalition_id = $1
         ORDER BY due_date ASC NULLS LAST, created_at DESC`,
        [id],
      ),
      this.db.query(
        `SELECT id, coalition_id, author_user_id, content, message_type, created_at
         FROM coalition_messages
         WHERE coalition_id = $1
         ORDER BY created_at DESC`,
        [id],
      ),
    ]);

    return {
      ...coalition,
      members: membersRes.rows as CoalitionMember[],
      commitments: commitmentsRes.rows as CoalitionCommitment[],
      messages: messagesRes.rows as CoalitionMessage[],
    };
  }

  async updateCoalition(
    id: string,
    userId: string,
    dto: Partial<Pick<Coalition, 'name' | 'bill_id' | 'is_active'>>,
  ): Promise<Coalition> {
    await this.authorizeOwner(id, userId);

    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined) {
      values.push(dto.name);
      fields.push(`name = $${values.length}`);
    }
    if (dto.bill_id !== undefined) {
      values.push(dto.bill_id);
      fields.push(`bill_id = $${values.length}`);
    }
    if (dto.is_active !== undefined) {
      values.push(dto.is_active);
      fields.push(`is_active = $${values.length}`);
    }

    if (fields.length === 0) {
      // Nothing to update — just return the current state
      return this.fetchCoalition(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await this.db.query(
      `UPDATE coalitions
       SET ${fields.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, bill_id, created_by, is_active, created_at, updated_at`,
      values,
    );
    return res.rows[0] as Coalition;
  }

  /** Soft delete: sets is_active = false. */
  async deleteCoalition(id: string, userId: string): Promise<void> {
    await this.authorizeOwner(id, userId);

    await this.db.query(
      `UPDATE coalitions SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  // ─── Member CRUD ─────────────────────────────────────────────────────────

  async addMember(
    coalitionId: string,
    userId: string,
    dto: AddMemberDto,
  ): Promise<CoalitionMember> {
    await this.authorizeOwner(coalitionId, userId);

    const res = await this.db.query(
      `INSERT INTO coalition_members
         (coalition_id, organization_name, contact_name, contact_email,
          contact_phone, stance, last_contact_date, notes, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, coalition_id, organization_name, contact_name, contact_email,
                 contact_phone, stance, last_contact_date, notes`,
      [
        coalitionId,
        dto.organization_name,
        dto.contact_name ?? null,
        dto.contact_email ?? null,
        dto.contact_phone ?? null,
        dto.stance ?? 'undecided',
        dto.last_contact_date ?? null,
        dto.notes ?? null,
        userId,
      ],
    );
    return res.rows[0] as CoalitionMember;
  }

  async updateMember(
    coalitionId: string,
    memberId: string,
    userId: string,
    dto: Partial<AddMemberDto>,
  ): Promise<CoalitionMember> {
    await this.authorizeOwner(coalitionId, userId);

    // Verify member belongs to this coalition
    const memberCheck = await this.db.query(
      `SELECT id FROM coalition_members WHERE id = $1 AND coalition_id = $2`,
      [memberId, coalitionId],
    );
    if (memberCheck.rows.length === 0) {
      throw new NotFoundException(
        `Member ${memberId} not found in coalition ${coalitionId}`,
      );
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    const updatable: Array<[keyof AddMemberDto, string]> = [
      ['organization_name', 'organization_name'],
      ['contact_name', 'contact_name'],
      ['contact_email', 'contact_email'],
      ['contact_phone', 'contact_phone'],
      ['stance', 'stance'],
      ['last_contact_date', 'last_contact_date'],
      ['notes', 'notes'],
    ];

    for (const [dtoKey, colName] of updatable) {
      if (dto[dtoKey] !== undefined) {
        values.push(dto[dtoKey]);
        fields.push(`${colName} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      const r = await this.db.query(
        `SELECT id, coalition_id, organization_name, contact_name, contact_email,
                contact_phone, stance, last_contact_date, notes
         FROM coalition_members WHERE id = $1`,
        [memberId],
      );
      return r.rows[0] as CoalitionMember;
    }

    fields.push(`updated_at = NOW()`);
    values.push(memberId);

    const res = await this.db.query(
      `UPDATE coalition_members
       SET ${fields.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, coalition_id, organization_name, contact_name, contact_email,
                 contact_phone, stance, last_contact_date, notes`,
      values,
    );
    return res.rows[0] as CoalitionMember;
  }

  async removeMember(
    coalitionId: string,
    memberId: string,
    userId: string,
  ): Promise<void> {
    await this.authorizeOwner(coalitionId, userId);

    const res = await this.db.query(
      `DELETE FROM coalition_members WHERE id = $1 AND coalition_id = $2`,
      [memberId, coalitionId],
    );
    if (res.rowCount === 0) {
      throw new NotFoundException(
        `Member ${memberId} not found in coalition ${coalitionId}`,
      );
    }
  }

  // ─── Commitment CRUD ─────────────────────────────────────────────────────

  async addCommitment(
    coalitionId: string,
    userId: string,
    dto: AddCommitmentDto,
  ): Promise<CoalitionCommitment> {
    await this.authorizeOwner(coalitionId, userId);

    const res = await this.db.query(
      `INSERT INTO coalition_commitments
         (coalition_id, coalition_member_id, description, due_date, status,
          completed_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, coalition_id, coalition_member_id, description,
                 due_date, status, completed_at`,
      [
        coalitionId,
        dto.coalition_member_id,
        dto.description,
        dto.due_date ?? null,
        dto.status ?? 'pending',
        dto.completed_at ?? null,
        userId,
      ],
    );
    return res.rows[0] as CoalitionCommitment;
  }

  async updateCommitment(
    coalitionId: string,
    commitmentId: string,
    userId: string,
    dto: Partial<AddCommitmentDto & { status: 'pending' | 'completed' | 'cancelled' }>,
  ): Promise<CoalitionCommitment> {
    await this.authorizeOwner(coalitionId, userId);

    const commitmentCheck = await this.db.query(
      `SELECT id FROM coalition_commitments WHERE id = $1 AND coalition_id = $2`,
      [commitmentId, coalitionId],
    );
    if (commitmentCheck.rows.length === 0) {
      throw new NotFoundException(
        `Commitment ${commitmentId} not found in coalition ${coalitionId}`,
      );
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.coalition_member_id !== undefined) {
      values.push(dto.coalition_member_id);
      fields.push(`coalition_member_id = $${values.length}`);
    }
    if (dto.description !== undefined) {
      values.push(dto.description);
      fields.push(`description = $${values.length}`);
    }
    if (dto.due_date !== undefined) {
      values.push(dto.due_date);
      fields.push(`due_date = $${values.length}`);
    }
    if (dto.status !== undefined) {
      values.push(dto.status);
      fields.push(`status = $${values.length}`);
      // Auto-set completed_at when marking as completed
      if (dto.status === 'completed' && dto.completed_at === undefined) {
        fields.push(`completed_at = NOW()`);
      }
    }
    if (dto.completed_at !== undefined) {
      values.push(dto.completed_at);
      fields.push(`completed_at = $${values.length}`);
    }

    if (fields.length === 0) {
      const r = await this.db.query(
        `SELECT id, coalition_id, coalition_member_id, description,
                due_date, status, completed_at
         FROM coalition_commitments WHERE id = $1`,
        [commitmentId],
      );
      return r.rows[0] as CoalitionCommitment;
    }

    fields.push(`updated_at = NOW()`);
    values.push(commitmentId);

    const res = await this.db.query(
      `UPDATE coalition_commitments
       SET ${fields.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, coalition_id, coalition_member_id, description,
                 due_date, status, completed_at`,
      values,
    );
    return res.rows[0] as CoalitionCommitment;
  }

  async deleteCommitment(
    coalitionId: string,
    commitmentId: string,
    userId: string,
  ): Promise<void> {
    await this.authorizeOwner(coalitionId, userId);

    const res = await this.db.query(
      `DELETE FROM coalition_commitments WHERE id = $1 AND coalition_id = $2`,
      [commitmentId, coalitionId],
    );
    if (res.rowCount === 0) {
      throw new NotFoundException(
        `Commitment ${commitmentId} not found in coalition ${coalitionId}`,
      );
    }
  }

  // ─── Messages ────────────────────────────────────────────────────────────

  async addMessage(
    coalitionId: string,
    userId: string,
    dto: AddMessageDto,
  ): Promise<CoalitionMessage> {
    await this.authorizeOwner(coalitionId, userId);

    const validTypes = ['note', 'agreed_argument', 'task_update', 'general'];
    const messageType = validTypes.includes(dto.message_type)
      ? dto.message_type
      : 'general';

    const res = await this.db.query(
      `INSERT INTO coalition_messages
         (coalition_id, author_user_id, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, coalition_id, author_user_id, content, message_type, created_at`,
      [coalitionId, userId, dto.content, messageType],
    );
    return res.rows[0] as CoalitionMessage;
  }

  async getMessages(
    coalitionId: string,
    userId: string,
  ): Promise<CoalitionMessage[]> {
    await this.authorizeOwner(coalitionId, userId);

    const res = await this.db.query(
      `SELECT id, coalition_id, author_user_id, content, message_type, created_at
       FROM coalition_messages
       WHERE coalition_id = $1
       ORDER BY created_at DESC`,
      [coalitionId],
    );
    return res.rows as CoalitionMessage[];
  }

  // ─── Lobbyists ───────────────────────────────────────────────────────────

  async searchLobbyists(query: string, sector?: string): Promise<unknown[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (query && query.trim().length > 0) {
      values.push(query.trim());
      // Full-text search using the GIN index on name, plus plain ilike on firm_name
      conditions.push(
        `(to_tsvector('spanish', name) @@ plainto_tsquery('spanish', $${values.length})
          OR firm_name ILIKE '%' || $${values.length} || '%')`,
      );
    }

    if (sector && sector.trim().length > 0) {
      values.push(`%${sector.trim()}%`);
      conditions.push(`sectors::text ILIKE $${values.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(50); // LIMIT
    const res = await this.db.query(
      `SELECT id, name, registration_number, firm_name,
              represented_clients, sectors, source_url, last_synced_at
       FROM registered_lobbyists
       ${where}
       ORDER BY name
       LIMIT $${values.length}`,
      values,
    );
    return res.rows;
  }

  async getLobbyistsByBillSector(billId: string): Promise<unknown[]> {
    // Fetch the bill's sector/type to match against lobbyist sectors
    const billRes = await this.db.query(
      `SELECT id, bill_type FROM sutra_measures WHERE id = $1`,
      [billId],
    );
    if (billRes.rows.length === 0) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    const billType: string = (billRes.rows[0] as { bill_type: string }).bill_type || '';

    if (!billType) {
      // No sector info — return all lobbyists ordered by name
      const res = await this.db.query(
        `SELECT id, name, registration_number, firm_name,
                represented_clients, sectors, source_url, last_synced_at
         FROM registered_lobbyists
         ORDER BY name
         LIMIT 50`,
      );
      return res.rows;
    }

    // Match lobbyists whose sectors JSONB array contains the bill_type string
    const res = await this.db.query(
      `SELECT id, name, registration_number, firm_name,
              represented_clients, sectors, source_url, last_synced_at
       FROM registered_lobbyists
       WHERE sectors::text ILIKE $1
       ORDER BY name
       LIMIT 50`,
      [`%${billType}%`],
    );
    return res.rows;
  }
}
