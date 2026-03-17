import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DossierChunk } from '../../entities/dossier-chunk.entity';
import { EmbeddingService } from '../ingestion/embedding.service';

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  chunk_type: string;
  section_reference?: string;
  page_number?: number;
  similarity: number;
}

// RRF: Reciprocal Rank Fusion — combines vector + keyword search rankings
function rrfScore(vectorRank: number, keywordRank: number, k = 60): number {
  return 1 / (k + vectorRank) + 1 / (k + keywordRank);
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(
    @InjectRepository(DossierChunk)
    private readonly chunkRepo: Repository<DossierChunk>,
    private readonly embeddingService: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {}

  async search(query: string, projectId: string, limit = 8): Promise<SearchResult[]> {
    const queryVector = await this.embeddingService.embedQuery(query);
    return this.hybridSearch(query, queryVector, projectId, limit);
  }

  async hybridSearch(
    queryText: string,
    queryVector: number[],
    projectId: string,
    limit = 8,
  ): Promise<SearchResult[]> {
    const vectorStr = `[${queryVector.join(',')}]`;

    // Vector search
    const vectorResults: Array<SearchResult & { rank: number }> = await this.dataSource.query(
      `SELECT id, document_id, content, chunk_type, section_reference, page_number,
              1 - (embedding <=> $1::vector) AS similarity,
              ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
       FROM dossier_chunks
       WHERE project_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vectorStr, projectId, limit * 2],
    );

    // Keyword search (full-text, Spanish)
    const keywordResults: Array<{ id: string; rank: number }> = await this.dataSource.query(
      `SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, query) DESC) AS rank
       FROM dossier_chunks, plainto_tsquery('spanish', $1) AS query
       WHERE project_id = $2 AND search_vector @@ query
       ORDER BY ts_rank(search_vector, query) DESC
       LIMIT $3`,
      [queryText, projectId, limit * 2],
    );

    // Build rank maps
    const vectorRankMap = new Map<string, number>();
    vectorResults.forEach((r) => vectorRankMap.set(r.id, Number(r.rank)));

    const keywordRankMap = new Map<string, number>();
    keywordResults.forEach((r) => keywordRankMap.set(r.id, Number(r.rank)));

    // Collect all unique IDs
    const allIds = new Set([...vectorRankMap.keys(), ...keywordRankMap.keys()]);

    // Score with RRF
    const scored: Array<{ id: string; score: number }> = [];
    allIds.forEach((id) => {
      const vr = vectorRankMap.get(id) ?? limit * 3;
      const kr = keywordRankMap.get(id) ?? limit * 3;
      scored.push({ id, score: rrfScore(vr, kr) });
    });

    scored.sort((a, b) => b.score - a.score);
    const topIds = scored.slice(0, limit).map((s) => s.id);

    // Fetch full data for top results
    if (topIds.length === 0) return [];

    const resultMap = new Map<string, SearchResult>();
    vectorResults.forEach((r) => resultMap.set(r.id, r));

    // For IDs only in keyword results, fetch from DB
    const missingIds = topIds.filter((id) => !resultMap.has(id));
    if (missingIds.length > 0) {
      const extra = await this.chunkRepo.findByIds(missingIds);
      extra.forEach((c) =>
        resultMap.set(c.id, {
          id: c.id,
          document_id: c.document_id,
          content: c.content,
          chunk_type: c.chunk_type,
          section_reference: c.section_reference,
          page_number: c.page_number,
          similarity: 0,
        }),
      );
    }

    return topIds
      .map((id) => resultMap.get(id))
      .filter((r): r is SearchResult => r !== undefined);
  }
}
