import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import {
  contractAnalysisQueue,
} from '../../queues';
import { CONTRACT_ANALYZER_CONSTANTS } from './contract-analyzer.constants';

// ─── Inline Multer file type (avoids @types/multer dependency) ──────────────
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

// ─── Internal types ──────────────────────────────────────────────────────────

export interface ContractClause {
  id: string;
  analysis_id: string;
  clause_index: number;
  clause_text: string;
  clause_type?: string;
}

export interface ContractReport {
  analysis: Record<string, unknown>;
  clauses: Array<
    ContractClause & {
      conflicts: Array<Record<string, unknown>>;
      risk_level: 'high' | 'medium' | 'low' | 'none';
    }
  >;
  summary: {
    total_clauses: number;
    clauses_with_conflicts: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
  };
  disclaimer: string;
}

interface GeminiClauseSegmentationResult {
  clauses: Array<{
    clause_index: number;
    clause_text: string;
    clause_type: string;
  }>;
}

interface GeminiConflictResult {
  conflicts: Array<{
    applicable_law: string;
    law_article: string;
    conflict_type: 'express_prohibition' | 'missing_mandatory_requirement' | 'potentially_void' | 'recommended_addition';
    risk_level: 'high' | 'medium' | 'low';
    description: string;
    suggested_correction: string;
  }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const UPLOAD_DIR = process.env.CONTRACT_UPLOAD_DIR || '/tmp/contracts';

@Injectable()
export class ContractAnalyzerService {
  private readonly logger = new Logger(ContractAnalyzerService.name);

  constructor(private readonly db: DatabaseService) {
    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async uploadAndQueue(
    userId: string,
    file: MulterFile | undefined,
  ): Promise<{ analysisId: string; status: string }> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'File type not allowed. Only PDF and DOCX files are accepted.',
      );
    }

    if (file.size > CONTRACT_ANALYZER_CONSTANTS.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds the maximum size of ${CONTRACT_ANALYZER_CONSTANTS.MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }

    // Resolve file path: Multer disk storage sets file.path; memory storage uses buffer
    let filePath: string;
    if (file.path) {
      filePath = file.path;
    } else if (file.buffer) {
      const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      filePath = path.join(UPLOAD_DIR, fileName);
      fs.writeFileSync(filePath, file.buffer);
    } else {
      throw new BadRequestException('Could not resolve file storage path.');
    }

    const insertResult = await this.db.query(
      `INSERT INTO contract_analyses
         (user_id, file_name, file_path, file_size, mime_type, analysis_status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [userId, file.originalname, filePath, file.size, file.mimetype],
    );

    const analysisId: string = insertResult.rows[0].id as string;

    try {
      await contractAnalysisQueue.add(
        'process-contract',
        { analysisId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      );
    } catch (queueErr: unknown) {
      const msg = queueErr instanceof Error ? queueErr.message : String(queueErr);
      this.logger.warn(`BullMQ unavailable, analysis ${analysisId} queued in DB only: ${msg}`);
      // The analysis remains in 'pending' state; an operator can trigger it manually
    }

    return { analysisId, status: 'pending' };
  }

  async getStatus(
    analysisId: string,
    userId: string,
  ): Promise<{ status: string; progress: string }> {
    const row = await this.fetchAnalysisRow(analysisId, userId);

    const progressMap: Record<string, string> = {
      pending:    'En cola — esperando procesamiento',
      extracting: 'Extrayendo texto del documento...',
      analyzing:  'Analizando cláusulas con IA...',
      completed:  'Análisis completado',
      error:      `Error: ${(row.analysis_error as string | null) ?? 'Error desconocido'}`,
    };

    const status = row.analysis_status as string;
    return {
      status,
      progress: progressMap[status] ?? status,
    };
  }

  async getReport(analysisId: string, userId: string): Promise<ContractReport> {
    const analysis = await this.fetchAnalysisRow(analysisId, userId);

    const clausesResult = await this.db.query(
      `SELECT id, analysis_id, clause_index, clause_text, clause_type
       FROM contract_clauses
       WHERE analysis_id = $1
       ORDER BY clause_index ASC`,
      [analysisId],
    );

    const conflictsResult = await this.db.query(
      `SELECT id, clause_id, analysis_id, applicable_law, law_article,
              conflict_type, risk_level, description, suggested_correction, created_at
       FROM contract_conflicts
       WHERE analysis_id = $1
       ORDER BY created_at ASC`,
      [analysisId],
    );

    // Group conflicts by clause
    const conflictsByClause = new Map<string, Array<Record<string, unknown>>>();
    for (const conflict of conflictsResult.rows as Array<Record<string, unknown>>) {
      const clauseId = conflict.clause_id as string;
      if (!conflictsByClause.has(clauseId)) conflictsByClause.set(clauseId, []);
      conflictsByClause.get(clauseId)!.push(conflict);
    }

    // Compute risk level per clause (highest risk among its conflicts)
    const riskOrder: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
    const clauses = (clausesResult.rows as Array<Record<string, unknown>>).map((clause) => {
      const clauseConflicts = conflictsByClause.get(clause.id as string) ?? [];
      let riskLevel: 'high' | 'medium' | 'low' | 'none' = 'none';
      for (const c of clauseConflicts) {
        const r = c.risk_level as 'high' | 'medium' | 'low' | 'none';
        if (riskOrder[r] > riskOrder[riskLevel]) riskLevel = r;
      }
      return {
        id: clause.id as string,
        analysis_id: clause.analysis_id as string,
        clause_index: clause.clause_index as number,
        clause_text: clause.clause_text as string,
        clause_type: clause.clause_type as string | undefined,
        conflicts: clauseConflicts,
        risk_level: riskLevel,
      };
    });

    // Summary stats
    const clausesWithConflicts = clauses.filter((c) => c.conflicts.length > 0).length;
    const highRisk = clauses.filter((c) => c.risk_level === 'high').length;
    const mediumRisk = clauses.filter((c) => c.risk_level === 'medium').length;
    const lowRisk = clauses.filter((c) => c.risk_level === 'low').length;

    return {
      analysis,
      clauses,
      summary: {
        total_clauses: clauses.length,
        clauses_with_conflicts: clausesWithConflicts,
        high_risk: highRisk,
        medium_risk: mediumRisk,
        low_risk: lowRisk,
      },
      disclaimer: CONTRACT_ANALYZER_CONSTANTS.LEGAL_DISCLAIMER,
    };
  }

  async getUserAnalyses(userId: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.query(
      `SELECT id, file_name, file_size, mime_type, analysis_status,
              clauses_count, conflicts_count, created_at, updated_at
       FROM contract_analyses
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId],
    );
    return result.rows as Array<Record<string, unknown>>;
  }

  async deleteAnalysis(analysisId: string, userId: string): Promise<void> {
    const row = await this.fetchAnalysisRow(analysisId, userId);

    // Remove uploaded file if it exists
    const filePath = row.file_path as string | null;
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Could not delete file ${filePath}: ${msg}`);
      }
    }

    // ON DELETE CASCADE handles contract_clauses and contract_conflicts
    await this.db.query(`DELETE FROM contract_analyses WHERE id = $1`, [analysisId]);
  }

  // ─── Processing Pipeline (called by BullMQ worker) ────────────────────────

  async processAnalysis(analysisId: string): Promise<void> {
    this.logger.log(`Starting contract analysis for ${analysisId}`);

    try {
      // Step 1: Extract text
      const text = await this.extractText(analysisId);
      if (!text.trim()) {
        await this.markError(analysisId, 'No se pudo extraer texto del documento.');
        return;
      }

      // Step 2: Segment clauses
      const clauses = await this.segmentClauses(text, analysisId);
      if (clauses.length === 0) {
        await this.markError(analysisId, 'No se identificaron cláusulas en el documento.');
        return;
      }

      // Step 3: Detect conflicts for each clause
      for (const clause of clauses) {
        await this.detectConflicts(clause, analysisId);
      }

      // Step 4: Count conflicts and mark completed
      const conflictCount = await this.db.query(
        `SELECT COUNT(*) FROM contract_conflicts WHERE analysis_id = $1`,
        [analysisId],
      );
      const totalConflicts = parseInt((conflictCount.rows[0] as { count: string }).count, 10);

      await this.db.query(
        `UPDATE contract_analyses
         SET analysis_status = 'completed',
             conflicts_count = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [totalConflicts, analysisId],
      );

      this.logger.log(
        `Contract analysis ${analysisId} completed: ${clauses.length} clauses, ${totalConflicts} conflicts`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Contract analysis ${analysisId} failed: ${msg}`);
      await this.markError(analysisId, msg);
      throw err;
    }
  }

  // ─── Private pipeline steps ───────────────────────────────────────────────

  private async extractText(analysisId: string): Promise<string> {
    await this.db.query(
      `UPDATE contract_analyses SET analysis_status = 'extracting', updated_at = NOW() WHERE id = $1`,
      [analysisId],
    );

    const result = await this.db.query(
      `SELECT file_path, mime_type FROM contract_analyses WHERE id = $1`,
      [analysisId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    const { file_path: filePath, mime_type: mimeType } = result.rows[0] as {
      file_path: string;
      mime_type: string;
    };

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      // DOCX — use mammoth
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require('mammoth') as {
        extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }>;
      };
      const extracted = await mammoth.extractRawText({ buffer });
      return extracted.value;
    }

    // PDF — use pdf-parse v2
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse') as {
      PDFParse: new () => { pdf(buf: Buffer): Promise<{ text: string }> };
    };
    const parser = new PDFParse();
    const pdfResult = await parser.pdf(buffer);
    return pdfResult.text;
  }

  private async segmentClauses(
    text: string,
    analysisId: string,
  ): Promise<ContractClause[]> {
    await this.db.query(
      `UPDATE contract_analyses SET analysis_status = 'analyzing', updated_at = NOW() WHERE id = $1`,
      [analysisId],
    );

    const truncatedText = text.substring(0, 8000);

    const prompt = `Analiza el siguiente contrato en español (de Puerto Rico) e identifica cada cláusula contractual individual.

Para cada cláusula devuelve un JSON con el siguiente formato EXACTO (sin texto adicional fuera del JSON):
{
  "clauses": [
    {
      "clause_index": 1,
      "clause_text": "Texto completo de la cláusula...",
      "clause_type": "tipo de cláusula (ej: indemnización, confidencialidad, rescisión, no competencia, arrendamiento, etc.)"
    }
  ]
}

Contrato:
---
${truncatedText}
---

Responde ÚNICAMENTE con el JSON, sin explicaciones ni texto adicional.`;

    const responseText = await this.callGemini(prompt);
    const parsed = this.parseJsonFromGemini<GeminiClauseSegmentationResult>(responseText);

    if (!parsed?.clauses || !Array.isArray(parsed.clauses)) {
      this.logger.warn(`Could not parse clause segmentation for ${analysisId}, using fallback`);
      // Fallback: treat each paragraph as a clause
      return this.fallbackSegment(text, analysisId);
    }

    const clauses: ContractClause[] = [];
    for (const rawClause of parsed.clauses) {
      const insertResult = await this.db.query(
        `INSERT INTO contract_clauses (analysis_id, clause_index, clause_text, clause_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, analysis_id, clause_index, clause_text, clause_type`,
        [analysisId, rawClause.clause_index, rawClause.clause_text, rawClause.clause_type ?? null],
      );
      clauses.push(insertResult.rows[0] as ContractClause);
    }

    // Update clauses count
    await this.db.query(
      `UPDATE contract_analyses SET clauses_count = $1, updated_at = NOW() WHERE id = $2`,
      [clauses.length, analysisId],
    );

    return clauses;
  }

  private async fallbackSegment(
    text: string,
    analysisId: string,
  ): Promise<ContractClause[]> {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30);

    const clauses: ContractClause[] = [];
    let index = 1;
    for (const para of paragraphs.slice(0, 50)) {
      const insertResult = await this.db.query(
        `INSERT INTO contract_clauses (analysis_id, clause_index, clause_text)
         VALUES ($1, $2, $3)
         RETURNING id, analysis_id, clause_index, clause_text, clause_type`,
        [analysisId, index, para],
      );
      clauses.push(insertResult.rows[0] as ContractClause);
      index++;
    }

    await this.db.query(
      `UPDATE contract_analyses SET clauses_count = $1, updated_at = NOW() WHERE id = $2`,
      [clauses.length, analysisId],
    );

    return clauses;
  }

  private async detectConflicts(
    clause: ContractClause,
    analysisId: string,
  ): Promise<void> {
    // 1. Generate embedding for clause text
    const embedding = await this.generateClauseEmbedding(clause.clause_text);

    // 2. Vector search in pr_legal_corpus
    let relevantLaws: Array<{ law_number: string; law_title: string; article_number: string; content: string }> = [];

    try {
      const embeddingStr = `[${embedding.join(',')}]`;
      const searchResult = await this.db.query(
        `SELECT law_number, law_title, article_number, content
         FROM pr_legal_corpus
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        [embeddingStr],
      );
      relevantLaws = searchResult.rows as typeof relevantLaws;
    } catch (vecErr: unknown) {
      const msg = vecErr instanceof Error ? vecErr.message : String(vecErr);
      this.logger.warn(`Vector search unavailable, using full corpus sample: ${msg}`);
      // Fallback: grab a few laws without vector search
      const fallbackResult = await this.db.query(
        `SELECT law_number, law_title, article_number, content
         FROM pr_legal_corpus
         LIMIT 5`,
      );
      relevantLaws = fallbackResult.rows as typeof relevantLaws;
    }

    if (relevantLaws.length === 0) {
      // No corpus available — skip conflict detection for this clause
      return;
    }

    // 3. Build context from relevant laws
    const legalContext = relevantLaws
      .map(
        (law) =>
          `[${law.law_number}${law.article_number ? ' — ' + law.article_number : ''}]\n${law.content.substring(0, 600)}`,
      )
      .join('\n\n---\n\n');

    // 4. Call Gemini conflict detection
    const prompt = `Eres un asistente legal especializado en derecho de Puerto Rico. Analiza la siguiente cláusula contractual e identifica posibles conflictos con las leyes de PR que se proveen.

CLÁUSULA CONTRACTUAL:
"""
${clause.clause_text.substring(0, 2000)}
"""

LEYES APLICABLES DE PUERTO RICO:
---
${legalContext}
---

Devuelve un JSON con el siguiente formato EXACTO (sin texto adicional):
{
  "conflicts": [
    {
      "applicable_law": "nombre de la ley (ej: Ley 80-1976)",
      "law_article": "artículo o sección específica",
      "conflict_type": "uno de: express_prohibition | missing_mandatory_requirement | potentially_void | recommended_addition",
      "risk_level": "uno de: high | medium | low",
      "description": "descripción clara del conflicto en español",
      "suggested_correction": "corrección sugerida en español"
    }
  ]
}

Si no hay conflictos, devuelve: {"conflicts": []}

Responde ÚNICAMENTE con el JSON.`;

    const responseText = await this.callGemini(prompt);
    const parsed = this.parseJsonFromGemini<GeminiConflictResult>(responseText);

    if (!parsed?.conflicts || !Array.isArray(parsed.conflicts)) {
      this.logger.warn(`Could not parse conflict detection for clause ${clause.id}`);
      return;
    }

    // 5. Save conflicts
    for (const conflict of parsed.conflicts) {
      await this.db.query(
        `INSERT INTO contract_conflicts
           (clause_id, analysis_id, applicable_law, law_article, conflict_type,
            risk_level, description, suggested_correction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          clause.id,
          analysisId,
          conflict.applicable_law,
          conflict.law_article,
          conflict.conflict_type,
          conflict.risk_level,
          conflict.description,
          conflict.suggested_correction,
        ],
      );
    }
  }

  // ─── Gemini helpers ───────────────────────────────────────────────────────

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — returning empty stub response');
      return '{}';
    }

    try {
      const response = await axios.post(
        `${CONTRACT_ANALYZER_CONSTANTS.GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        },
        { timeout: 60000 },
      );

      const data = response.data as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gemini API call failed: ${msg}`);
      return '{}';
    }
  }

  private parseJsonFromGemini<T>(text: string): T {
    try {
      // Strip markdown code fences if present
      let cleaned = text.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
      }

      // Find first '{' and last '}'
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return {} as T;
      }

      return JSON.parse(cleaned.substring(start, end + 1)) as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`JSON parse from Gemini failed: ${msg}. Raw: ${text.substring(0, 200)}`);
      return {} as T;
    }
  }

  private async generateClauseEmbedding(text: string): Promise<number[]> {
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
          taskType: 'RETRIEVAL_QUERY',
        },
        { timeout: 30000 },
      );
      return (response.data as { embedding: { values: number[] } }).embedding.values;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Clause embedding generation failed: ${msg}`);
      return new Array(CONTRACT_ANALYZER_CONSTANTS.EMBEDDING_DIMENSIONS).fill(0);
    }
  }

  // ─── DB helpers ───────────────────────────────────────────────────────────

  private async fetchAnalysisRow(
    analysisId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `SELECT * FROM contract_analyses WHERE id = $1`,
      [analysisId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Analysis ${analysisId} not found.`);
    }

    const row = result.rows[0] as Record<string, unknown>;
    if (row.user_id !== userId) {
      throw new ForbiddenException('Access denied to this analysis.');
    }

    return row;
  }

  private async markError(analysisId: string, errorMessage: string): Promise<void> {
    await this.db.query(
      `UPDATE contract_analyses
       SET analysis_status = 'error',
           analysis_error = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [errorMessage, analysisId],
    );
  }
}
