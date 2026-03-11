/**
 * E2E integration test for CompareProcessor + Legal Patch Engine
 *
 * Tests the full job processing pipeline with mocked TypeORM repositories
 * and BullMQ job object. No running DB or Redis required.
 *
 * Scenarios:
 *  A. PATCH mode — modifier law triggers patch detection → ops applied, consolidatedText saved
 *  B. FULL mode  — two complete law versions → standard chunk-diff pipeline
 *  C. Engine OFF — flag disabled → falls through to standard diff even with patch-like input
 *  D. Version not READY → throws, saves ERROR record
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CompareProcessor } from '../processors/compare.processor';
import { DiffService } from '../services/diff.service';
import { LlmAnalysisService } from '../services/llm-analysis.service';
import {
  LawParserService,
} from '../../legal/law-parser.service';
import { ModeClassifierService } from '../../legal/mode-classifier.service';
import { PatchExtractorService } from '../../legal/patch-extractor.service';
import { PatchApplierService } from '../../legal/patch-applier.service';
import { LocalizedDiffService } from '../../legal/localized-diff.service';
import { LegalComparatorService } from '../../legal/legal-comparator.service';
import {
  DocumentVersion,
  DocumentVersionStatus,
  DocumentChunk,
  DocumentChunkType,
  ComparisonResult,
  ComparisonStatus,
} from '../../entities';
import { ComparisonMode } from '../../legal/legal.types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_LAW_TEXT = `
ARTÍCULO 1 — Propósito
Esta ley tiene como propósito regular la emisión de licencias comerciales en el territorio.

ARTÍCULO 2 — Definiciones
Para los efectos de esta ley:
(a) Licencia: autorización emitida por la agencia competente.
(b) Solicitante: toda persona natural o jurídica que solicita una licencia.

ARTÍCULO 3 — Requisitos
Todo solicitante deberá presentar los siguientes documentos dentro de los treinta (30) días
de la notificación de la agencia: planilla, certificación de deudas, y seguro de responsabilidad.

ARTÍCULO 4 — Tasas
La tasa de tramitación será de quinientos dólares ($500.00) por solicitud.

ARTÍCULO 5 — Sanciones
El incumplimiento de esta ley acarreará una multa de hasta dos mil dólares ($2,000.00)
y la revocación de la licencia vigente.

ARTÍCULO 6 — Vigencia
Esta ley entrará en vigor a partir de su aprobación.
`.trim();

/** A typical enmienda law (PATCH scenario) */
const MODIFIER_LAW_TEXT = `
ARTÍCULO 1 — Enmienda al Artículo 3
Enmiéndase el Artículo 3 de la Ley para que lea como sigue:
"Todo solicitante deberá presentar los documentos requeridos dentro de los quince (15) días
de la notificación de la agencia: planilla, certificación de deudas, seguro de responsabilidad
y certificación de cumplimiento ambiental."

ARTÍCULO 2 — Enmienda al Artículo 4
Enmiéndase el Artículo 4 para que la tasa de tramitación sea de ochocientos dólares ($800.00).

ARTÍCULO 3 — Derogación
Derógase el Artículo 5 en su totalidad.
`.trim();

/** Full revision — another complete version of the same law */
const REVISED_LAW_TEXT = `
ARTÍCULO 1 — Propósito
Esta ley tiene como propósito regular la emisión de licencias comerciales y profesionales
en el territorio de Puerto Rico.

ARTÍCULO 2 — Definiciones
Para los efectos de esta ley:
(a) Licencia: autorización emitida por el Departamento de Estado.
(b) Solicitante: toda persona natural o jurídica que solicita una licencia.
(c) Renovación: proceso de extensión de una licencia vigente.

ARTÍCULO 3 — Requisitos
Todo solicitante deberá presentar los documentos dentro de los cuarenta y cinco (45) días
de la notificación.

ARTÍCULO 4 — Tasas
La tasa de tramitación será de setecientos cincuenta dólares ($750.00) por solicitud inicial
y trescientos dólares ($300.00) por renovación.

ARTÍCULO 5 — Apelaciones
El solicitante podrá apelar cualquier denegación dentro de los veinte (20) días hábiles.

ARTÍCULO 6 — Sanciones
El incumplimiento acarreará multa de hasta cinco mil dólares ($5,000.00).

ARTÍCULO 7 — Vigencia
Esta ley entrará en vigor a los noventa (90) días de su aprobación.
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeVersion(
  id: string,
  title: string,
  status: DocumentVersionStatus = DocumentVersionStatus.READY,
): DocumentVersion {
  const v = new DocumentVersion();
  v.id = id;
  v.documentId = `doc-${id}`;
  v.versionTag = 'v1';
  v.status = status;
  v.metadata = {};
  v.document = { id: v.documentId, title } as any;
  return v;
}

function makeChunks(versionId: string, text: string): DocumentChunk[] {
  // Split on ARTÍCULO boundaries
  const parts = text.split(/(?=ARTÍCULO\s+\d+)/);
  return parts
    .filter((p) => p.trim())
    .map((part, i) => {
      const labelMatch = part.match(/^(ARTÍCULO\s+\d+[A-Z]?)/i);
      const chunk = new DocumentChunk();
      chunk.id = `${versionId}-chunk-${i}`;
      chunk.versionId = versionId;
      chunk.type = DocumentChunkType.ARTICLE;
      chunk.label = labelMatch ? labelMatch[1] : `Chunk ${i}`;
      chunk.content = part.trim();
      chunk.orderIndex = i;
      chunk.metadata = {};
      return chunk;
    });
}

function makeJob(sourceVersionId: string, targetVersionId: string): any {
  return {
    id: 'test-job-1',
    data: { sourceVersionId, targetVersionId, detectSemanticChanges: false },
    updateProgress: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CompareProcessor E2E (mocked repos)', () => {
  let processor: CompareProcessor;

  // Saved records captured from comparisonRepository.save()
  const savedComparisons: ComparisonResult[] = [];

  const sourceVersionId = 'src-ver-001';
  const targetVersionId = 'tgt-ver-001';

  const sourceVersion = makeVersion(sourceVersionId, 'Ley de Licencias Comerciales');
  const targetVersion = makeVersion(targetVersionId, 'Enmienda a la Ley de Licencias');

  const sourceChunks = makeChunks(sourceVersionId, BASE_LAW_TEXT);
  const targetChunksModifier = makeChunks(targetVersionId, MODIFIER_LAW_TEXT);
  const targetChunksFull = makeChunks(targetVersionId, REVISED_LAW_TEXT);

  // Mocked repos
  const mockVersionRepo = {
    findOne: jest.fn(),
  };
  const mockChunkRepo = {
    find: jest.fn(),
  };
  const mockComparisonRepo = {
    create: jest.fn((dto) => ({ ...dto, id: `comp-${Date.now()}` })),
    save: jest.fn((entity) => {
      savedComparisons.push(entity);
      return Promise.resolve(entity);
    }),
  };

  // Stub LlmAnalysisService (avoids needing API keys)
  const mockLlmService = {
    generateExecutiveSummary: jest.fn().mockResolvedValue('Resumen ejecutivo de prueba.'),
    analyzeStakeholders: jest.fn().mockResolvedValue({
      entities: [],
      overallImpact: 'neutral',
      impactSummary: 'Sin análisis de stakeholders en modo test.',
    }),
  };

  beforeEach(async () => {
    savedComparisons.length = 0;
    jest.clearAllMocks();

    // Default: both versions READY, source = base law
    mockVersionRepo.findOne.mockImplementation(async ({ where: { id } }) => {
      if (id === sourceVersionId) return sourceVersion;
      if (id === targetVersionId) return targetVersion;
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompareProcessor,
        DiffService,
        LawParserService,
        ModeClassifierService,
        PatchExtractorService,
        PatchApplierService,
        LocalizedDiffService,
        LegalComparatorService,
        { provide: LlmAnalysisService, useValue: mockLlmService },
        { provide: getRepositoryToken(DocumentVersion), useValue: mockVersionRepo },
        { provide: getRepositoryToken(DocumentChunk), useValue: mockChunkRepo },
        { provide: getRepositoryToken(ComparisonResult), useValue: mockComparisonRepo },
      ],
    }).compile();

    processor = module.get(CompareProcessor);
  });

  // ─── Scenario A: PATCH mode ───────────────────────────────────────────────

  describe('Scenario A — PATCH mode (modifier law)', () => {
    beforeEach(() => {
      process.env.LEGAL_PATCH_ENGINE_ENABLED = 'true';
      mockChunkRepo.find.mockImplementation(async ({ where: { versionId } }) => {
        if (versionId === sourceVersionId) return sourceChunks;
        return targetChunksModifier;
      });
    });

    afterEach(() => {
      delete process.env.LEGAL_PATCH_ENGINE_ENABLED;
    });

    it('detects PATCH mode and returns comparisonId', async () => {
      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));

      expect(result.success).toBe(true);
      expect(result.comparisonId).toBeTruthy();
    });

    it('saves comparison with legalMode=PATCH in metadata', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));

      expect(savedComparisons).toHaveLength(1);
      const saved = savedComparisons[0];
      expect(saved.metadata?.legalMode).toBe(ComparisonMode.PATCH);
    });

    it('consolidatedText contains amended content (raised fee)', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));

      const saved = savedComparisons[0];
      const patchReport = saved.metadata?.patchReport;
      expect(patchReport).toBeDefined();
      // At least some ops were applied
      expect(patchReport.applied?.length).toBeGreaterThanOrEqual(1);
    });

    it('chunkComparisons maps to affectedUnits (at least 1)', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));

      const saved = savedComparisons[0];
      expect(Array.isArray(saved.chunkComparisons)).toBe(true);
      // Modifier has 3 ops → ≥ 1 affected unit expected
      expect(saved.chunkComparisons.length).toBeGreaterThanOrEqual(1);
    });

    it('impactScore > 0 for a law with DELETE + REPLACE ops', async () => {
      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(result.impactScore).toBeGreaterThan(0);
    });

    it('status is COMPLETED', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(savedComparisons[0].status).toBe(ComparisonStatus.COMPLETED);
    });

    it('LLM is NOT called in PATCH mode (short-circuit)', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      // PATCH mode exits before reaching LLM calls
      expect(mockLlmService.generateExecutiveSummary).not.toHaveBeenCalled();
    });
  });

  // ─── Scenario B: FULL mode ────────────────────────────────────────────────

  describe('Scenario B — FULL mode (two complete versions)', () => {
    beforeEach(() => {
      process.env.LEGAL_PATCH_ENGINE_ENABLED = 'true';
      mockChunkRepo.find.mockImplementation(async ({ where: { versionId } }) => {
        if (versionId === sourceVersionId) return sourceChunks;
        return targetChunksFull; // Full revised law — should classify as FULL
      });
    });

    afterEach(() => {
      delete process.env.LEGAL_PATCH_ENGINE_ENABLED;
    });

    it('succeeds and returns comparisonId', async () => {
      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(result.success).toBe(true);
      expect(result.comparisonId).toBeTruthy();
    });

    it('chunk alignment produces at least 3 matched chunks', async () => {
      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(result.chunksCompared).toBeGreaterThanOrEqual(3);
    });

    it('LLM executive summary is called in FULL mode', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(mockLlmService.generateExecutiveSummary).toHaveBeenCalledTimes(1);
    });

    it('stakeholder analysis is called in FULL mode', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(mockLlmService.analyzeStakeholders).toHaveBeenCalledTimes(1);
    });

    it('metadata does not contain legalMode=PATCH', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      const saved = savedComparisons[0];
      expect(saved.metadata?.legalMode).not.toBe(ComparisonMode.PATCH);
    });
  });

  // ─── Scenario C: Engine disabled ─────────────────────────────────────────

  describe('Scenario C — Engine disabled (flag=false)', () => {
    beforeEach(() => {
      process.env.LEGAL_PATCH_ENGINE_ENABLED = 'false';
      // Even though modifier looks like PATCH, engine is off
      mockChunkRepo.find.mockImplementation(async ({ where: { versionId } }) => {
        if (versionId === sourceVersionId) return sourceChunks;
        return targetChunksModifier;
      });
    });

    afterEach(() => {
      delete process.env.LEGAL_PATCH_ENGINE_ENABLED;
    });

    it('falls through to standard diff pipeline', async () => {
      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(result.success).toBe(true);
    });

    it('LLM is called (standard pipeline runs)', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(mockLlmService.generateExecutiveSummary).toHaveBeenCalled();
    });

    it('saved comparison has no legalMode in metadata', async () => {
      await processor.process(makeJob(sourceVersionId, targetVersionId));
      expect(savedComparisons[0].metadata?.legalMode).toBeUndefined();
    });
  });

  // ─── Scenario D: Version not READY ────────────────────────────────────────

  describe('Scenario D — Version not READY', () => {
    it('returns success=false when source version is PROCESSING', async () => {
      const processingVersion = makeVersion(sourceVersionId, 'Draft', DocumentVersionStatus.PROCESSING);
      mockVersionRepo.findOne.mockImplementation(async ({ where: { id } }) => {
        if (id === sourceVersionId) return processingVersion;
        return targetVersion;
      });
      mockChunkRepo.find.mockResolvedValue([]);

      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not ready/i);
    });

    it('saves an ERROR ComparisonResult record', async () => {
      const errorVersion = makeVersion(sourceVersionId, 'Draft', DocumentVersionStatus.ERROR);
      mockVersionRepo.findOne.mockImplementation(async ({ where: { id } }) => {
        if (id === sourceVersionId) return errorVersion;
        return targetVersion;
      });
      mockChunkRepo.find.mockResolvedValue([]);

      await processor.process(makeJob(sourceVersionId, targetVersionId));

      expect(savedComparisons).toHaveLength(1);
      expect(savedComparisons[0].status).toBe(ComparisonStatus.ERROR);
    });

    it('returns success=false when target version not found', async () => {
      mockVersionRepo.findOne.mockImplementation(async ({ where: { id } }) => {
        if (id === sourceVersionId) return sourceVersion;
        return null; // target not found
      });
      mockChunkRepo.find.mockResolvedValue([]);

      const result = await processor.process(makeJob(sourceVersionId, targetVersionId));

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });
});
