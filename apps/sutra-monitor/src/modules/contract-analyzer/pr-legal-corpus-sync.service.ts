// ARQUITECTURA: Corpus legal de PR para búsqueda semántica
// Modelo de embeddings: text-embedding-004 (Gemini, 768 dims) — mismo modelo que lw-rag-engine
// Estrategia de chunking: por artículo (splits en "Artículo", "Sección", "Art.")
// FUENTE: bvirtualogp.pr.gov — actualización semanal cron domingo 3AM PR

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import { CONTRACT_ANALYZER_CONSTANTS } from './contract-analyzer.constants';

interface LawChunk {
  article_number: string;
  article_title: string;
  content: string;
}

interface LawInfo {
  number: string;
  title: string;
  url: string;
}

@Injectable()
export class PrLegalCorpusSyncService {
  private readonly logger = new Logger(PrLegalCorpusSyncService.name);

  constructor(private readonly db: DatabaseService) {}

  @Cron(CONTRACT_ANALYZER_CONSTANTS.CORPUS_SYNC_CRON, { timeZone: 'America/Puerto_Rico' })
  async syncCorpus(): Promise<void> {
    this.logger.log('Starting PR Legal Corpus sync...');
    const result = await this.manualSync();
    this.logger.log(`Corpus sync complete: ${result.synced} chunks synced, ${result.errors} errors`);
  }

  async manualSync(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    for (const lawInfo of CONTRACT_ANALYZER_CONSTANTS.PRIORITY_LAWS) {
      try {
        const text = await this.downloadAndParseLaw(lawInfo);
        if (!text.trim()) {
          this.logger.warn(`No text extracted for ${lawInfo.number}, skipping`);
          continue;
        }

        const chunks = this.chunkLawText(text, lawInfo.number, lawInfo.title);
        this.logger.log(`${lawInfo.number}: ${chunks.length} chunks extracted`);

        for (const chunk of chunks) {
          try {
            const embedding = await this.generateEmbedding(chunk.content);
            await this.upsertChunk(lawInfo.number, lawInfo.title, chunk, embedding, lawInfo.url);
            synced++;
          } catch (chunkErr: unknown) {
            const msg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
            this.logger.warn(`Failed to embed/upsert chunk for ${lawInfo.number} art.${chunk.article_number}: ${msg}`);
            errors++;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to process law ${lawInfo.number}: ${msg}`);
        errors++;
      }
    }

    return { synced, errors };
  }

  private async downloadAndParseLaw(lawInfo: LawInfo): Promise<string> {
    try {
      const response = await axios.get(lawInfo.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'LegalWatch/2026 (bvirtualogp corpus sync)' },
      });

      const buffer = Buffer.from(response.data as ArrayBuffer);
      // Dynamically require pdf-parse (v2 API)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PDFParse } = require('pdf-parse') as { PDFParse: new () => { pdf(buf: Buffer): Promise<{ text: string }> } };
      const parser = new PDFParse();
      const result = await parser.pdf(buffer);
      return result.text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not download/parse law ${lawInfo.number} from ${lawInfo.url}: ${msg}`);
      return '';
    }
  }

  private chunkLawText(lawText: string, lawNumber: string, lawTitle: string): LawChunk[] {
    // Markers: "Artículo", "Articulo", "Art.", "Sección", "Seccion", "Sec."
    const articlePattern = /^(Art[íi]culo\s+\d+[\w.-]*|Art\.\s*\d+[\w.-]*|Secci[oó]n\s+\d+[\w.-]*|Sec\.\s*\d+[\w.-]*)/im;
    const splitPattern = /(?=^(?:Art[íi]culo\s+\d+|Art\.\s*\d+|Secci[oó]n\s+\d+|Sec\.\s*\d+))/im;

    const parts = lawText.split(new RegExp(splitPattern.source, 'gim'));

    const chunks: LawChunk[] = [];
    let chunkIndex = 0;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.length < 50) continue;

      const headerMatch = trimmed.match(articlePattern);
      const articleNumber = headerMatch ? headerMatch[1].trim() : `chunk_${chunkIndex}`;

      // Derive title from first line if present
      const firstLineEnd = trimmed.indexOf('\n');
      const firstLine = firstLineEnd > 0 ? trimmed.substring(0, firstLineEnd).trim() : trimmed.substring(0, 120).trim();
      const articleTitle = firstLine.length > articleNumber.length
        ? firstLine.replace(articleNumber, '').trim().substring(0, 200)
        : `${lawNumber} — ${articleNumber}`;

      chunks.push({
        article_number: articleNumber,
        article_title: articleTitle,
        content: trimmed.substring(0, 4000), // cap per chunk
      });

      chunkIndex++;
    }

    // If no splits were found, treat entire text as one chunk
    if (chunks.length === 0 && lawText.trim().length > 50) {
      chunks.push({
        article_number: 'general',
        article_title: lawTitle,
        content: lawText.trim().substring(0, 4000),
      });
    }

    return chunks;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Array(CONTRACT_ANALYZER_CONSTANTS.EMBEDDING_DIMENSIONS).fill(0);
    }

    try {
      const response = await axios.post(
        `${CONTRACT_ANALYZER_CONSTANTS.GEMINI_EMBEDDING_URL}?key=${apiKey}`,
        {
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
        },
        { timeout: 30000 },
      );
      return (response.data as { embedding: { values: number[] } }).embedding.values;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Embedding generation failed: ${msg}`);
      return new Array(CONTRACT_ANALYZER_CONSTANTS.EMBEDDING_DIMENSIONS).fill(0);
    }
  }

  private async upsertChunk(
    lawNumber: string,
    lawTitle: string,
    chunk: LawChunk,
    embedding: number[],
    sourceUrl: string,
  ): Promise<void> {
    const embeddingStr = `[${embedding.join(',')}]`;

    await this.db.query(
      `INSERT INTO pr_legal_corpus
         (law_number, law_title, article_number, article_title, content, source_url, last_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (law_number, article_number)
       DO UPDATE SET
         law_title       = EXCLUDED.law_title,
         article_title   = EXCLUDED.article_title,
         content         = EXCLUDED.content,
         source_url      = EXCLUDED.source_url,
         last_updated_at = NOW()`,
      [lawNumber, lawTitle, chunk.article_number, chunk.article_title, chunk.content, sourceUrl],
    );

    // Update embedding separately (pgvector syntax, skip if column not available)
    try {
      await this.db.query(
        `UPDATE pr_legal_corpus
         SET embedding = $1::vector
         WHERE law_number = $2 AND article_number = $3`,
        [embeddingStr, lawNumber, chunk.article_number],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Could not update embedding vector (pgvector may be unavailable): ${msg}`);
    }
  }
}
