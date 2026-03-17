import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { DossierDocument, DocumentProcessingStatus } from '../../entities/dossier-document.entity';
import { DossierChunk } from '../../entities/dossier-chunk.entity';
import { DossierProject } from '../../entities/dossier-project.entity';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(DossierDocument)
    private readonly docRepo: Repository<DossierDocument>,
    @InjectRepository(DossierChunk)
    private readonly chunkRepo: Repository<DossierChunk>,
    @InjectRepository(DossierProject)
    private readonly projectRepo: Repository<DossierProject>,
    @InjectQueue('document-ingestion')
    private readonly ingestionQueue: Queue,
  ) {}

  async uploadDocument(
    projectId: string,
    file: Express.Multer.File,
  ): Promise<DossierDocument> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, deleted: false } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // If multer used memory storage, persist the buffer to disk now
    let filePath = file.path;
    if (!filePath && file.buffer) {
      const uploadDir = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '..', '..', '..', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      filePath = path.join(uploadDir, `${uniqueSuffix}${ext}`);
      fs.writeFileSync(filePath, file.buffer);
    }

    const doc = this.docRepo.create({
      project_id: projectId,
      file_name: file.originalname,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.mimetype,
      processing_status: DocumentProcessingStatus.PENDING,
    });

    const saved = await this.docRepo.save(doc);

    await this.ingestionQueue.add('process-document', {
      documentId: saved.id,
      projectId,
    });

    this.logger.log(`Document ${saved.id} queued for ingestion`);
    return saved;
  }

  async listDocuments(projectId: string): Promise<DossierDocument[]> {
    return this.docRepo.find({
      where: { project_id: projectId },
      order: { uploaded_at: 'DESC' },
    });
  }

  async getDocumentStatus(projectId: string, docId: string): Promise<DossierDocument> {
    const doc = await this.docRepo.findOne({ where: { id: docId, project_id: projectId } });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);
    return doc;
  }

  async deleteDocument(projectId: string, docId: string): Promise<void> {
    const doc = await this.docRepo.findOne({ where: { id: docId, project_id: projectId } });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);

    // Delete file from disk
    try {
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
      }
    } catch (err) {
      this.logger.warn(`Could not delete file ${doc.file_path}: ${err}`);
    }

    // Delete chunks
    await this.chunkRepo.delete({ document_id: docId });
    await this.docRepo.remove(doc);
  }
}
