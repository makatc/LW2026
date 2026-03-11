import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as path from 'path';
import * as fs from 'fs';

// DECISION: Inline Multer file type to avoid @types/multer dependency issues with pnpm store
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

@Injectable()
export class InteractionsService {
    private readonly logger = new Logger(InteractionsService.name);
    private readonly uploadDir: string;

    constructor(private readonly db: DatabaseService) {
        // DECISION: Store uploads locally under data/interaction-attachments/
        // In production, this would be replaced with S3/MinIO
        this.uploadDir = path.resolve(process.cwd(), 'data', 'interaction-attachments');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async findAll(params: {
        legislatorId?: string;
        dateFrom?: string;
        dateTo?: string;
        contactType?: string;
        limit: number;
        offset: number;
    }) {
        const conditions: string[] = ['i.is_deleted = false'];
        const values: any[] = [];

        if (params.legislatorId) {
            values.push(params.legislatorId);
            conditions.push(`i.legislator_id = $${values.length}`);
        }
        if (params.dateFrom) {
            values.push(params.dateFrom);
            conditions.push(`i.interaction_date >= $${values.length}`);
        }
        if (params.dateTo) {
            values.push(params.dateTo);
            conditions.push(`i.interaction_date <= $${values.length}`);
        }
        if (params.contactType) {
            values.push(params.contactType);
            conditions.push(`i.contact_type = $${values.length}`);
        }

        const where = `WHERE ${conditions.join(' AND ')}`;
        values.push(params.limit);
        values.push(params.offset);

        const res = await this.db.query(
            `SELECT i.*,
                    l.full_name AS legislator_name,
                    l.party AS legislator_party,
                    l.chamber AS legislator_chamber,
                    (SELECT COUNT(*) FROM interaction_attachments ia WHERE ia.interaction_id = i.id)::int AS attachment_count,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'measure_id', im.measure_id,
                            'measure_reference', im.measure_reference,
                            'position_expressed', im.position_expressed
                        )) FROM interaction_measures im WHERE im.interaction_id = i.id), '[]'
                    ) AS measures
             FROM interactions i
             JOIN legislators l ON l.id = i.legislator_id
             ${where}
             ORDER BY i.interaction_date DESC
             LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        );

        const countRes = await this.db.query(
            `SELECT COUNT(*) FROM interactions i ${where}`,
            values.slice(0, -2)
        );

        return {
            data: res.rows,
            total: parseInt(countRes.rows[0].count, 10),
        };
    }

    async findOne(id: string) {
        const res = await this.db.query(
            `SELECT i.*,
                    l.full_name AS legislator_name,
                    l.party AS legislator_party,
                    l.chamber AS legislator_chamber,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'id', ip.id,
                            'staff_id', ip.staff_id,
                            'legislator_id', ip.legislator_id,
                            'custom_name', ip.custom_name,
                            'staff_name', ls.name,
                            'staff_title', ls.title
                        )) FROM interaction_participants ip
                          LEFT JOIN legislator_staff ls ON ls.id = ip.staff_id
                          WHERE ip.interaction_id = i.id), '[]'
                    ) AS participants,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'id', im.id,
                            'measure_id', im.measure_id,
                            'measure_reference', im.measure_reference,
                            'position_expressed', im.position_expressed,
                            'measure_number', sm.numero,
                            'measure_title', sm.titulo
                        )) FROM interaction_measures im
                          LEFT JOIN sutra_measures sm ON sm.id = im.measure_id
                          WHERE im.interaction_id = i.id), '[]'
                    ) AS measures,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'id', ia.id,
                            'file_name', ia.file_name,
                            'file_size', ia.file_size,
                            'mime_type', ia.mime_type,
                            'uploaded_at', ia.uploaded_at
                        )) FROM interaction_attachments ia
                          WHERE ia.interaction_id = i.id), '[]'
                    ) AS attachments
             FROM interactions i
             JOIN legislators l ON l.id = i.legislator_id
             WHERE i.id = $1 AND i.is_deleted = false`,
            [id]
        );

        if (!res.rows[0]) throw new NotFoundException('Interaction not found');
        return res.rows[0];
    }

    async create(dto: {
        legislator_id: string;
        contact_type: string;
        interaction_date: string;
        notes?: string;
        next_step_description?: string;
        next_step_date?: string;
        participants?: Array<{ staff_id?: string; legislator_id: string; custom_name?: string }>;
        measures?: Array<{ measure_id?: string; measure_reference?: string; position_expressed?: string }>;
    }, userId?: string) {
        // Step 1: Insert the interaction
        const interRes = await this.db.query(
            `INSERT INTO interactions
             (legislator_id, contact_type, interaction_date, notes, next_step_description, next_step_date, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                dto.legislator_id,
                dto.contact_type,
                dto.interaction_date,
                dto.notes || null,
                dto.next_step_description || null,
                dto.next_step_date || null,
                userId || null,
            ]
        );

        const interaction = interRes.rows[0];
        const interactionId = interaction.id;

        // Step 2: Insert participants
        if (dto.participants && dto.participants.length > 0) {
            for (const p of dto.participants) {
                await this.db.query(
                    `INSERT INTO interaction_participants (interaction_id, staff_id, legislator_id, custom_name)
                     VALUES ($1, $2, $3, $4)`,
                    [interactionId, p.staff_id || null, p.legislator_id, p.custom_name || null]
                );
            }
        }

        // Step 3: Insert measures and update positions
        if (dto.measures && dto.measures.length > 0) {
            for (const m of dto.measures) {
                await this.db.query(
                    `INSERT INTO interaction_measures (interaction_id, measure_id, measure_reference, position_expressed)
                     VALUES ($1, $2, $3, $4)`,
                    [interactionId, m.measure_id || null, m.measure_reference || null, m.position_expressed || null]
                );

                // If there's a confirmed position + measure_id, upsert into legislator_measure_positions
                if (m.position_expressed && m.measure_id) {
                    // Mark any existing AI suggestions as superseded
                    await this.db.query(
                        `UPDATE legislator_measure_positions
                         SET is_superseded = true, updated_at = NOW()
                         WHERE legislator_id = $1 AND measure_id = $2 AND position_type = 'sugerida_por_ia' AND is_superseded = false`,
                        [dto.legislator_id, m.measure_id]
                    );

                    // Upsert confirmed position
                    await this.db.query(
                        `INSERT INTO legislator_measure_positions
                         (legislator_id, measure_id, position, position_type, source_interaction_id)
                         VALUES ($1, $2, $3, 'confirmada', $4)
                         ON CONFLICT (legislator_id, measure_id) WHERE position_type = 'confirmada'
                         DO UPDATE SET position = $3, source_interaction_id = $4, updated_at = NOW()`,
                        [dto.legislator_id, m.measure_id, m.position_expressed, interactionId]
                    );
                }
            }
        }

        this.logger.log(`📝 Interaction created: ${interactionId} for legislator ${dto.legislator_id}`);

        // DECISION: EventEmitter2 for next_step_date is deferred to Phase 2.
        // The data is saved and available for future calendar module consumption.

        return this.findOne(interactionId);
    }

    async update(id: string, dto: {
        contact_type?: string;
        interaction_date?: string;
        notes?: string;
        next_step_description?: string;
        next_step_date?: string;
    }) {
        const allowed = ['contact_type', 'interaction_date', 'notes', 'next_step_description', 'next_step_date'];
        const updates: string[] = [];
        const values: any[] = [];

        for (const key of allowed) {
            if ((dto as any)[key] !== undefined) {
                values.push((dto as any)[key]);
                updates.push(`${key} = $${values.length}`);
            }
        }

        if (updates.length === 0) throw new NotFoundException('No valid fields to update');

        values.push(id);
        updates.push(`updated_at = NOW()`);

        const res = await this.db.query(
            `UPDATE interactions SET ${updates.join(', ')} WHERE id = $${values.length} AND is_deleted = false RETURNING *`,
            values
        );
        if (!res.rows[0]) throw new NotFoundException('Interaction not found');
        return this.findOne(id);
    }

    async softDelete(id: string) {
        const res = await this.db.query(
            `UPDATE interactions SET is_deleted = true, updated_at = NOW() WHERE id = $1 RETURNING id`,
            [id]
        );
        if (!res.rows[0]) throw new NotFoundException('Interaction not found');
        return { success: true, id: res.rows[0].id };
    }

    // ─── Attachments ──────────────────────────────────────────────────────────

    async uploadAttachment(interactionId: string, file: MulterFile) {
        // Verify interaction exists
        const check = await this.db.query(
            `SELECT id FROM interactions WHERE id = $1 AND is_deleted = false`,
            [interactionId]
        );
        if (!check.rows[0]) throw new NotFoundException('Interaction not found');

        // Save file to disk
        const filename = `${interactionId}_${Date.now()}_${file.originalname}`;
        const filePath = path.join(this.uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);

        // Insert record
        const res = await this.db.query(
            `INSERT INTO interaction_attachments
             (interaction_id, file_name, file_path, file_size, mime_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [interactionId, file.originalname, filePath, file.size, file.mimetype]
        );

        return res.rows[0];
    }

    async deleteAttachment(interactionId: string, attachmentId: string) {
        const res = await this.db.query(
            `DELETE FROM interaction_attachments
             WHERE id = $1 AND interaction_id = $2
             RETURNING file_path`,
            [attachmentId, interactionId]
        );

        if (!res.rows[0]) throw new NotFoundException('Attachment not found');

        // Delete file from disk
        try {
            if (fs.existsSync(res.rows[0].file_path)) {
                fs.unlinkSync(res.rows[0].file_path);
            }
        } catch (err) {
            this.logger.warn(`Failed to delete file: ${res.rows[0].file_path}`);
        }

        return { success: true };
    }

    async getAttachments(interactionId: string) {
        const res = await this.db.query(
            `SELECT id, file_name, file_size, mime_type, uploaded_at
             FROM interaction_attachments
             WHERE interaction_id = $1
             ORDER BY uploaded_at DESC`,
            [interactionId]
        );
        return { data: res.rows };
    }
}
