import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Document } from '../../entities/document.entity';
import { DocumentVersion } from '../../entities/document-version.entity';

export interface SearchResult {
  document: Document;
  latestVersion?: DocumentVersion;
  score: number; // Relevance score 0-1
  matchedFields: string[]; // Which fields matched the query
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  includeVersions?: boolean;
  documentType?: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
  ) {}

  /**
   * Search documents by query string
   * Searches in: title, description, metadata
   */
  async searchDocuments(options: SearchOptions): Promise<{
    results: SearchResult[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      query,
      limit = 20,
      offset = 0,
      includeVersions = true,
      documentType,
    } = options;

    this.logger.log(`Searching documents: "${query}"`);

    if (!query || query.trim().length < 2) {
      return { results: [], total: 0, hasMore: false };
    }

    const searchTerm = `%${query.trim()}%`;

    // Build query
    const queryBuilder = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.title ILIKE :searchTerm', { searchTerm })
      .orWhere('doc.description ILIKE :searchTerm', { searchTerm });

    // Filter by document type if specified
    if (documentType) {
      queryBuilder.andWhere('doc.documentType = :documentType', {
        documentType,
      });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const documents = await queryBuilder
      .orderBy('doc.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    // Build search results
    const results: SearchResult[] = [];

    for (const document of documents) {
      const matchedFields: string[] = [];
      let score = 0;

      // Calculate relevance score based on matches
      const lowerQuery = query.toLowerCase();
      const lowerTitle = document.title.toLowerCase();
      const lowerDescription = (document.description || '').toLowerCase();

      // Exact title match = highest score
      if (lowerTitle === lowerQuery) {
        score = 1.0;
        matchedFields.push('title (exact)');
      } else if (lowerTitle.includes(lowerQuery)) {
        score = 0.8;
        matchedFields.push('title');
      }

      // Description match
      if (lowerDescription.includes(lowerQuery)) {
        score = Math.max(score, 0.5);
        matchedFields.push('description');
      }

      // Metadata match (search in stringified metadata)
      const metadataStr = JSON.stringify(document.metadata).toLowerCase();
      if (metadataStr.includes(lowerQuery)) {
        score = Math.max(score, 0.3);
        matchedFields.push('metadata');
      }

      // Get latest version if requested
      let latestVersion: DocumentVersion | undefined;
      if (includeVersions) {
        latestVersion =
          (await this.versionRepo.findOne({
            where: { documentId: document.id },
            order: { createdAt: 'DESC' },
          })) || undefined;
      }

      results.push({
        document,
        latestVersion,
        score,
        matchedFields,
      });
    }

    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);

    return {
      results,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Search for documents similar to a given text
   * Uses simple keyword matching for now
   * TODO: Implement vector similarity search using pgvector
   */
  async findSimilarDocuments(
    text: string,
    limit = 10,
  ): Promise<SearchResult[]> {
    this.logger.log(`Finding similar documents to text (${text.length} chars)`);

    // Extract keywords (simple approach: get unique words)
    const keywords = this.extractKeywords(text);

    if (keywords.length === 0) {
      return [];
    }

    // Search for documents containing these keywords
    const results: SearchResult[] = [];

    for (const keyword of keywords.slice(0, 5)) {
      // Limit to top 5 keywords
      const searchResults = await this.searchDocuments({
        query: keyword,
        limit: 5,
        includeVersions: false,
      });

      results.push(...searchResults.results);
    }

    // Remove duplicates and sort by score
    const uniqueResults = this.deduplicateResults(results);

    return uniqueResults.slice(0, limit);
  }

  /**
   * Find documents by IDs
   */
  async findByIds(ids: string[]): Promise<Document[]> {
    if (ids.length === 0) return [];

    return this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.id IN (:...ids)', { ids })
      .getMany();
  }

  /**
   * Extract keywords from text (simple implementation)
   */
  private extractKeywords(text: string): string[] {
    // Remove common Spanish stopwords
    const stopwords = new Set([
      'el',
      'la',
      'de',
      'que',
      'y',
      'a',
      'en',
      'un',
      'ser',
      'se',
      'no',
      'haber',
      'por',
      'con',
      'su',
      'para',
      'como',
      'estar',
      'tener',
      'le',
      'lo',
      'todo',
      'pero',
      'más',
      'hacer',
      'o',
      'poder',
      'decir',
      'este',
      'ir',
      'otro',
      'ese',
      'la',
      'si',
      'me',
      'ya',
      'ver',
      'porque',
      'dar',
      'cuando',
      'él',
      'muy',
      'sin',
      'vez',
      'mucho',
      'saber',
      'qué',
      'sobre',
      'mi',
      'alguno',
      'mismo',
      'yo',
      'también',
      'hasta',
      'año',
      'dos',
      'querer',
      'entre',
      'así',
      'primero',
      'desde',
      'grande',
      'esa',
      'ni',
      'nos',
      'llegar',
      'pasar',
      'tiempo',
      'ella',
      'sí',
      'día',
      'uno',
      'bien',
      'poco',
      'deber',
      'entonces',
      'poner',
      'cosa',
      'tanto',
      'hombre',
      'parecer',
      'nuestro',
      'tan',
      'donde',
      'ahora',
      'parte',
      'después',
      'vida',
      'quedar',
      'siempre',
      'creer',
      'hablar',
      'llevar',
      'dejar',
      'nada',
      'cada',
      'seguir',
      'menos',
      'nuevo',
      'encontrar',
      'algo',
      'solo',
      'decir',
      'salir',
      'volver',
      'tomar',
      'conocer',
      'vivir',
      'sentir',
      'tratar',
      'mirar',
      'contar',
      'empezar',
      'esperar',
      'buscar',
      'existir',
      'entrar',
      'trabajar',
      'escribir',
      'perder',
      'producir',
      'ocurrir',
      'entender',
      'pedir',
      'recibir',
      'recordar',
      'terminar',
      'permitir',
      'aparecer',
      'conseguir',
      'comenzar',
      'servir',
      'sacar',
      'necesitar',
      'mantener',
      'resultar',
      'leer',
      'caer',
      'cambiar',
      'presentar',
      'crear',
      'abrir',
      'considerar',
      'oír',
      'acabar',
      'mil',
      'contra',
      'final',
      'añadir',
      'tal',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !stopwords.has(word));

    // Get unique words with frequency
    const wordFreq: Map<string, number> = new Map();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Sort by frequency and return top words
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }

  /**
   * Remove duplicate search results by document ID
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.document.id)) {
        seen.add(result.document.id);
        unique.push(result);
      }
    }

    return unique.sort((a, b) => b.score - a.score);
  }
}
