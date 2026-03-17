import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// ARQUITECTURA: Usamos Gemini text-embedding-004 (768 dims).
// Razones: 1) GEMINI_API_KEY ya configurada en el proyecto. 2) Sin dependencias adicionales.
// 3) 768 dims es suficiente para retrieval legislativo en español.
// Ver docs/EMBEDDING_DECISION.md para detalles completos.

const GEMINI_EMBEDDING_MODEL = 'models/text-embedding-004';
const EMBEDDING_DIMS = 768;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — embeddings will be stubbed with zero vectors');
    }
  }

  async embed(text: string, retries = 3): Promise<number[]> {
    if (!this.apiKey) {
      return new Array(EMBEDDING_DIMS).fill(0);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${this.apiKey}`,
          {
            model: GEMINI_EMBEDDING_MODEL,
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
          },
          { timeout: 30000 },
        );
        return response.data.embedding.values as number[];
      } catch (err) {
        if (attempt === retries) {
          this.logger.error(`Embedding failed after ${retries} attempts: ${err}`);
          throw err;
        }
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`Embedding attempt ${attempt} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return new Array(EMBEDDING_DIMS).fill(0);
  }

  async embedQuery(text: string): Promise<number[]> {
    if (!this.apiKey) {
      return new Array(EMBEDDING_DIMS).fill(0);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${this.apiKey}`,
        {
          model: GEMINI_EMBEDDING_MODEL,
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_QUERY',
        },
        { timeout: 30000 },
      );
      return response.data.embedding.values as number[];
    } catch (err) {
      this.logger.error(`Query embedding failed: ${err}`);
      return new Array(EMBEDDING_DIMS).fill(0);
    }
  }
}
