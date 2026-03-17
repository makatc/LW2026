import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';
import { DossierProject } from '../../entities/dossier-project.entity';
import { DossierDocument, DocumentProcessingStatus } from '../../entities/dossier-document.entity';

export interface FiscalContextAvailability {
  measure_reference: string | null;
  fiscal_notes_count: number;
  fomb_actions_count: number;
  total: number;
}

export interface FiscalContextInjectResult {
  documents_created: number;
  fiscal_notes_ingested: number;
  fomb_actions_ingested: number;
}

@Injectable()
export class FiscalContextService {
  private readonly logger = new Logger(FiscalContextService.name);

  constructor(
    @InjectRepository(DossierProject)
    private readonly projectRepo: Repository<DossierProject>,
    @InjectRepository(DossierDocument)
    private readonly docRepo: Repository<DossierDocument>,
    @InjectQueue('document-ingestion')
    private readonly ingestionQueue: Queue,
    private readonly dataSource: DataSource,
  ) {}

  async getFiscalContextAvailable(projectId: string): Promise<FiscalContextAvailability> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, deleted: false } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const measureRef = project.measure_reference ?? null;
    if (!measureRef) {
      return {
        measure_reference: null,
        fiscal_notes_count: 0,
        fomb_actions_count: 0,
        total: 0,
      };
    }

    const normalizedRef = measureRef.trim().toUpperCase();

    // Query fiscal_notes table — may not exist yet; handle gracefully
    let fiscalNotesCount = 0;
    try {
      const result = await this.dataSource.query(
        `SELECT COUNT(*) AS cnt FROM fiscal_notes
         WHERE UPPER(TRIM(measure_reference)) = $1
            OR UPPER(TRIM(bill_number)) = $1`,
        [normalizedRef],
      );
      fiscalNotesCount = parseInt(result[0]?.cnt ?? '0', 10);
    } catch (err) {
      this.logger.warn(`fiscal_notes table query failed (may not exist yet): ${err}`);
    }

    // Query fomb_actions table
    let fombActionsCount = 0;
    try {
      const result = await this.dataSource.query(
        `SELECT COUNT(*) AS cnt FROM fomb_actions
         WHERE UPPER(TRIM(law_number)) = $1
            OR UPPER(TRIM(bill_number)) = $1`,
        [normalizedRef],
      );
      fombActionsCount = parseInt(result[0]?.cnt ?? '0', 10);
    } catch (err) {
      this.logger.warn(`fomb_actions table query failed (may not exist yet): ${err}`);
    }

    return {
      measure_reference: measureRef,
      fiscal_notes_count: fiscalNotesCount,
      fomb_actions_count: fombActionsCount,
      total: fiscalNotesCount + fombActionsCount,
    };
  }

  async injectFiscalContext(projectId: string): Promise<FiscalContextInjectResult> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, deleted: false } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const measureRef = project.measure_reference?.trim().toUpperCase();
    if (!measureRef) {
      this.logger.warn(`Project ${projectId} has no measure_reference; skipping fiscal context injection`);
      return { documents_created: 0, fiscal_notes_ingested: 0, fomb_actions_ingested: 0 };
    }

    let fiscalNotesIngested = 0;
    let fombActionsIngested = 0;

    // --- Ingest fiscal_notes ---
    try {
      const fiscalNotes = await this.dataSource.query(
        `SELECT * FROM fiscal_notes
         WHERE UPPER(TRIM(measure_reference)) = $1
            OR UPPER(TRIM(bill_number)) = $1`,
        [measureRef],
      );

      for (const note of fiscalNotes) {
        const title = note.title ?? note.file_name ?? `Nota Fiscal - ${measureRef}`;
        const rawContent = note.raw_content ?? note.content_text ?? note.extracted_text ?? '';

        const doc = await this.createAutoIngestedDocument(
          projectId,
          title,
          rawContent,
          'fiscal_intelligence',
        );

        if (doc) {
          await this.queueIngestion(doc.id, projectId);
          fiscalNotesIngested++;
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch/ingest fiscal_notes: ${err}`);
    }

    // --- Ingest fomb_actions ---
    try {
      const fombActions = await this.dataSource.query(
        `SELECT * FROM fomb_actions
         WHERE UPPER(TRIM(law_number)) = $1
            OR UPPER(TRIM(bill_number)) = $1`,
        [measureRef],
      );

      for (const action of fombActions) {
        const title = action.title ?? action.action_type ?? `Acción FOMB - ${measureRef}`;
        const rawContent = this.buildFombActionText(action);

        const doc = await this.createAutoIngestedDocument(
          projectId,
          title,
          rawContent,
          'fiscal_intelligence',
        );

        if (doc) {
          await this.queueIngestion(doc.id, projectId);
          fombActionsIngested++;
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch/ingest fomb_actions: ${err}`);
    }

    const documentsCreated = fiscalNotesIngested + fombActionsIngested;
    this.logger.log(
      `Fiscal context injected for project ${projectId}: ${fiscalNotesIngested} fiscal notes, ${fombActionsIngested} FOMB actions`,
    );

    return {
      documents_created: documentsCreated,
      fiscal_notes_ingested: fiscalNotesIngested,
      fomb_actions_ingested: fombActionsIngested,
    };
  }

  private buildFombActionText(action: Record<string, unknown>): string {
    const lines: string[] = [];
    if (action.action_type) lines.push(`Tipo de acción: ${action.action_type}`);
    if (action.action_date) lines.push(`Fecha: ${action.action_date}`);
    if (action.law_number) lines.push(`Ley/Medida: ${action.law_number}`);
    if (action.bill_number) lines.push(`Número de medida: ${action.bill_number}`);
    if (action.fiscal_year) lines.push(`Año fiscal: ${action.fiscal_year}`);
    if (action.agency) lines.push(`Agencia: ${action.agency}`);
    if (action.amount) lines.push(`Monto: ${action.amount}`);
    if (action.description) lines.push(`\nDescripción:\n${action.description}`);
    if (action.rationale) lines.push(`\nRazonamiento:\n${action.rationale}`);
    if (action.raw_content) lines.push(`\nContenido:\n${action.raw_content}`);
    return lines.join('\n');
  }

  private async createAutoIngestedDocument(
    projectId: string,
    title: string,
    contentText: string,
    source: string,
  ): Promise<DossierDocument | null> {
    try {
      // Write content to a temp file so the existing ingestion pipeline can read it
      const uploadDir = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(process.cwd(), 'uploads');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const fileName = `fiscal-auto-${uniqueSuffix}.txt`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, contentText ?? '', 'utf-8');

      const doc = this.docRepo.create({
        project_id: projectId,
        file_name: title,
        original_name: title,
        file_path: filePath,
        file_size: Buffer.byteLength(contentText ?? '', 'utf-8'),
        mime_type: 'text/plain',
        processing_status: DocumentProcessingStatus.PENDING,
        auto_ingested: true,
        source,
        content_text: contentText,
      });

      return await this.docRepo.save(doc);
    } catch (err) {
      this.logger.error(`Failed to create auto-ingested document for project ${projectId}: ${err}`);
      return null;
    }
  }

  private async queueIngestion(documentId: string, projectId: string): Promise<void> {
    await this.ingestionQueue.add('process-document', { documentId, projectId });
  }
}
