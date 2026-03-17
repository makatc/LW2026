import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DossierDocument, DocumentProcessingStatus } from '../../entities/dossier-document.entity';
import { DossierChunk } from '../../entities/dossier-chunk.entity';
import { EmbeddingService } from './embedding.service';
import { LegislativeChunker } from './legislative-chunker';

@Processor('document-ingestion')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    @InjectRepository(DossierDocument)
    private readonly docRepo: Repository<DossierDocument>,
    @InjectRepository(DossierChunk)
    private readonly chunkRepo: Repository<DossierChunk>,
    private readonly embeddingService: EmbeddingService,
    private readonly chunker: LegislativeChunker,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string; projectId: string }>): Promise<void> {
    const { documentId, projectId } = job.data;
    this.logger.log(`Processing document ${documentId}`);

    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) {
      this.logger.error(`Document ${documentId} not found`);
      return;
    }

    try {
      await this.docRepo.update(documentId, {
        processing_status: DocumentProcessingStatus.PROCESSING,
      });

      const text = await this.extractText(doc);
      const rawChunks = this.chunker.chunk(text);

      this.logger.log(`Document ${documentId}: ${rawChunks.length} chunks extracted`);

      // Delete old chunks if re-processing
      await this.chunkRepo.delete({ document_id: documentId });

      const savedChunks: DossierChunk[] = [];

      for (const rawChunk of rawChunks) {
        let embedding: number[];
        try {
          embedding = await this.embeddingService.embed(rawChunk.content);
        } catch (err) {
          this.logger.warn(`Could not embed chunk ${rawChunk.chunk_index}: ${err}. Using zero vector.`);
          embedding = new Array(768).fill(0);
        }

        const chunk = this.chunkRepo.create({
          document_id: documentId,
          project_id: projectId,
          chunk_index: rawChunk.chunk_index,
          content: rawChunk.content,
          chunk_type: rawChunk.chunk_type,
          section_reference: rawChunk.section_reference,
          page_number: rawChunk.page_number,
          embedding,
        });

        savedChunks.push(await this.chunkRepo.save(chunk));
      }

      await this.docRepo.update(documentId, {
        processing_status: DocumentProcessingStatus.COMPLETED,
        chunk_count: savedChunks.length,
        processed_at: new Date(),
      });

      this.logger.log(`Document ${documentId} processed: ${savedChunks.length} chunks`);
    } catch (err) {
      this.logger.error(`Failed to process document ${documentId}: ${err}`);
      await this.docRepo.update(documentId, {
        processing_status: DocumentProcessingStatus.ERROR,
        processing_error: String(err),
      });
    }
  }

  private async extractText(doc: DossierDocument): Promise<string> {
    const ext = path.extname(doc.file_name).toLowerCase();
    const buffer = fs.readFileSync(doc.file_path);

    if (ext === '.pdf' || doc.mime_type === 'application/pdf') {
      return this.extractPdf(buffer, doc);
    }

    if (ext === '.docx' || doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.extractDocx(buffer);
    }

    // TXT, MD, etc.
    return buffer.toString('utf-8');
  }

  private async extractPdf(buffer: Buffer, doc: DossierDocument): Promise<string> {
    try {
      // pdf-parse v2 uses class-based API
      const { PDFParse } = require('pdf-parse') as { PDFParse: new () => { pdf: (b: Buffer) => Promise<{ text: string }> } };
      const result = await new PDFParse().pdf(buffer);
      if (result.text && result.text.trim().length > 100) {
        return result.text;
      }
      // Scanned PDF fallback: use Gemini OCR
      return this.ocrWithGemini(buffer, doc.file_name);
    } catch {
      return this.ocrWithGemini(buffer, doc.file_name);
    }
  }

  private async ocrWithGemini(buffer: Buffer, fileName: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn(`No GEMINI_API_KEY for OCR of ${fileName}`);
      return '';
    }
    try {
      const base64 = buffer.toString('base64');
      const response = await require('axios').default.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [
              { text: 'Extract all text from this document. Return only the extracted text, preserving structure.' },
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
            ],
          }],
        },
        { timeout: 60000 },
      );
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (err) {
      this.logger.error(`Gemini OCR failed for ${fileName}: ${err}`);
      return '';
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}
