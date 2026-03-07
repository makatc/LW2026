import { Test, TestingModule } from '@nestjs/testing';
import { LawParserService } from '../law-parser.service';
import { ModeClassifierService } from '../mode-classifier.service';
import { PatchExtractorService } from '../patch-extractor.service';
import { PatchApplierService } from '../patch-applier.service';
import { LocalizedDiffService } from '../localized-diff.service';
import { LegalComparatorService } from '../legal-comparator.service';
import { DiffService } from '../../comparison/services/diff.service';
import { ComparisonMode } from '../legal.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_LAW = `
ARTÍCULO 1 — Propósito
Esta ley tiene como propósito establecer las normas básicas de convivencia ciudadana.

ARTÍCULO 2 — Definiciones
Para los efectos de esta ley, los siguientes términos se definen de la siguiente manera:
(a) Ciudadano: toda persona natural residente en el territorio.
(b) Entidad: toda persona jurídica con fines de lucro.

ARTÍCULO 3 — Obligaciones
Todo ciudadano deberá cumplir con las disposiciones establecidas en esta ley dentro de los treinta (30) días de su aprobación.

ARTÍCULO 4 — Sanciones
El incumplimiento de esta ley conllevará una multa de quinientos dólares ($500.00).

ARTÍCULO 5 — Vigencia
Esta ley entrará en vigor a partir de su aprobación y publicación en el Registro Oficial.
`.trim();

// ─── LawParserService ─────────────────────────────────────────────────────────

describe('LawParserService', () => {
  let parser: LawParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LawParserService],
    }).compile();
    parser = module.get(LawParserService);
  });

  it('parses all 5 articles', () => {
    const ast = parser.parse(BASE_LAW);
    const articles = ast.root.children.filter((n) => n.type === 'ARTICLE');
    expect(articles).toHaveLength(5);
  });

  it('indexes articles by normalized label', () => {
    const ast = parser.parse(BASE_LAW);
    expect(ast.index.has('articulo 1')).toBe(true);
    expect(ast.index.has('articulo 5')).toBe(true);
  });

  it('indexes articles by id', () => {
    const ast = parser.parse(BASE_LAW);
    expect(ast.index.has('art_1')).toBe(true);
    expect(ast.index.has('art_3')).toBe(true);
  });

  it('normalizeLabel removes accents and punctuation', () => {
    expect(parser.normalizeLabel('Artículo 5')).toBe('articulo 5');
    expect(parser.normalizeLabel('Art. 3A')).toBe('articulo 3a');
    expect(parser.normalizeLabel('Sección IV')).toBe('seccion iv');
  });

  it('reconstructText round-trips through the AST', () => {
    const ast = parser.parse(BASE_LAW);
    const reconstructed = parser.reconstructText(ast.root);
    // All article labels should appear in the reconstructed text
    expect(reconstructed).toContain('Artículo 1');
    expect(reconstructed).toContain('Artículo 5');
  });
});

// ─── ModeClassifierService ────────────────────────────────────────────────────

describe('ModeClassifierService', () => {
  let classifier: ModeClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModeClassifierService],
    }).compile();
    classifier = module.get(ModeClassifierService);
  });

  it('classifies two full versions as FULL', () => {
    const result = classifier.classify(BASE_LAW, BASE_LAW.replace('30', '60'));
    expect(result.mode).toBe(ComparisonMode.FULL);
  });

  it('classifies a short amend law as PATCH', () => {
    const modifier = `
ARTÍCULO 1 — Enmienda
Enmiéndase el Artículo 3 de la Ley para que lea como sigue:
"Todo ciudadano deberá cumplir con las disposiciones dentro de los sesenta (60) días de su aprobación."
`.trim();
    const result = classifier.classify(BASE_LAW, modifier);
    expect(result.mode).toBe(ComparisonMode.PATCH);
    expect(result.confidence).toBeGreaterThan(0.35);
  });

  it('triggers include amend verb when found', () => {
    const modifier = 'Enmiéndase el Artículo 3 para que lea: nuevo texto';
    const result = classifier.classify(BASE_LAW, modifier);
    expect(result.triggers.some((t) => t.startsWith('verb:'))).toBe(true);
  });

  it('triggers include ratio when modifier is tiny', () => {
    const modifier = 'Derógase el Artículo 4.';
    const result = classifier.classify(BASE_LAW, modifier);
    expect(result.triggers.some((t) => t.startsWith('ratio='))).toBe(true);
  });
});

// ─── PatchExtractorService ────────────────────────────────────────────────────

describe('PatchExtractorService', () => {
  let extractor: PatchExtractorService;
  let parser: LawParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LawParserService, PatchExtractorService],
    }).compile();
    extractor = module.get(PatchExtractorService);
    parser = module.get(LawParserService);
  });

  it('extracts REPLACE op from enmiéndase instruction', () => {
    const modifier = `
ARTÍCULO 1 — Enmienda al Artículo 3
Enmiéndase el Artículo 3 para que lea como sigue:
"Todo ciudadano deberá cumplir con las disposiciones dentro de los sesenta (60) días de su aprobación."
`.trim();

    const baseAst = parser.parse(BASE_LAW);
    const ops = extractor.extract(modifier, baseAst);

    expect(ops.length).toBeGreaterThanOrEqual(1);
    const replace = ops.find((o) => o.type === 'REPLACE');
    expect(replace).toBeDefined();
    expect(replace?.targetLabel).toMatch(/artículo\s+3/i);
  });

  it('extracts DELETE op from derógase instruction', () => {
    const modifier = 'Derógase el Artículo 4 de la presente ley.';
    const baseAst = parser.parse(BASE_LAW);
    const ops = extractor.extract(modifier, baseAst);

    const del = ops.find((o) => o.type === 'DELETE');
    expect(del).toBeDefined();
    expect(del?.targetLabel).toMatch(/artículo\s+4/i);
  });

  it('extracts INSERT_AFTER op from añádase instruction', () => {
    const modifier = `
ARTÍCULO 1 — Adición
Añádase un nuevo Artículo 3A después del Artículo 3 para que lea como sigue:
"Las entidades quedan exentas de este requisito si cuentan con certificación vigente."
`.trim();

    const baseAst = parser.parse(BASE_LAW);
    const ops = extractor.extract(modifier, baseAst);

    const insert = ops.find((o) => o.type === 'INSERT_AFTER' || o.type === 'INSERT_BEFORE');
    expect(insert).toBeDefined();
  });

  it('extracts AMEND_PARTIAL op from phrase substitution', () => {
    const modifier = `
ARTÍCULO 1 — Corrección
En el Artículo 4, la frase "$500.00" se sustituye por "$1,000.00".
`.trim();

    const baseAst = parser.parse(BASE_LAW);
    const ops = extractor.extract(modifier, baseAst);

    const partial = ops.find((o) => o.type === 'AMEND_PARTIAL');
    expect(partial).toBeDefined();
    expect(partial?.targetPhrase).toBe('$500.00');
    expect(partial?.newText).toBe('$1,000.00');
  });

  it('resolves targetId when article exists in base', () => {
    const modifier = 'Derógase el Artículo 2 de la presente ley.';
    const baseAst = parser.parse(BASE_LAW);
    const ops = extractor.extract(modifier, baseAst);

    expect(ops[0].targetId).toBe('ART_2');
    expect(ops[0].confidence).toBe(1.0);
  });

  it('marks op as needsReview when target not found', () => {
    const modifier = 'Derógase el Artículo 99 de la presente ley.';
    const baseAst = parser.parse(BASE_LAW);
    const ops = extractor.extract(modifier, baseAst);

    expect(ops[0].targetId).toBeUndefined();
    expect(ops[0].confidence).toBeLessThan(1.0);
  });
});

// ─── PatchApplierService ──────────────────────────────────────────────────────

describe('PatchApplierService', () => {
  let applier: PatchApplierService;
  let parser: LawParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LawParserService, PatchApplierService],
    }).compile();
    applier = module.get(PatchApplierService);
    parser = module.get(LawParserService);
  });

  it('REPLACE: replaces article content', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'REPLACE',
        targetId: 'ART_3',
        targetLabel: 'Artículo 3',
        newText: 'Todo ciudadano deberá cumplir en sesenta (60) días.',
        confidence: 1.0,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    expect(report.applied).toHaveLength(1);
    expect(report.consolidatedText).toContain('sesenta (60) días');
    expect(report.consolidatedText).not.toContain('treinta (30) días');
  });

  it('DELETE: removes article from consolidated text', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'DELETE',
        targetId: 'ART_4',
        targetLabel: 'Artículo 4',
        confidence: 1.0,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    expect(report.applied).toHaveLength(1);
    expect(report.consolidatedText).not.toContain('Artículo 4');
    expect(report.consolidatedText).not.toContain('quinientos dólares');
  });

  it('INSERT_AFTER: adds new node after anchor', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'INSERT_AFTER',
        targetId: 'ART_2',
        targetLabel: 'Artículo 2',
        newText: 'Las entidades certificadas quedan exentas de este requisito.',
        confidence: 0.9,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    expect(report.applied).toHaveLength(1);
    expect(report.consolidatedText).toContain('certificadas quedan exentas');
  });

  it('AMEND_PARTIAL: replaces phrase within article', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'AMEND_PARTIAL',
        targetId: 'ART_4',
        targetLabel: 'Artículo 4',
        targetPhrase: '$500.00',
        newText: '$1,000.00',
        confidence: 0.95,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    expect(report.applied).toHaveLength(1);
    expect(report.consolidatedText).toContain('$1,000.00');
    expect(report.consolidatedText).not.toContain('$500.00');
  });

  it('skips op with confidence < 0.7 and needsReview=true', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'DELETE',
        targetLabel: 'Artículo 99',
        confidence: 0.5,
        evidence: 'test',
        needsReview: true,
        reviewReason: 'Target not found',
      },
    ]);

    expect(report.applied).toHaveLength(0);
    expect(report.needsReview).toHaveLength(1);
  });

  it('does not mutate the original AST', () => {
    const ast = parser.parse(BASE_LAW);
    const originalArticleCount = ast.root.children.length;

    applier.apply(ast, [
      {
        type: 'DELETE',
        targetId: 'ART_1',
        targetLabel: 'Artículo 1',
        confidence: 1.0,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    // Original AST unchanged
    expect(ast.root.children).toHaveLength(originalArticleCount);
  });

  it('RENUMBER: renames article labels', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'RENUMBER',
        targetLabel: 'Artículo 5',
        renumberMap: { 'Artículo 5': 'Artículo 6' },
        confidence: 0.8,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    expect(report.applied).toHaveLength(1);
    expect(report.consolidatedText).toContain('Artículo 6');
  });

  it('multiple ops applied in sequence', () => {
    const ast = parser.parse(BASE_LAW);
    const report = applier.apply(ast, [
      {
        type: 'REPLACE',
        targetId: 'ART_3',
        targetLabel: 'Artículo 3',
        newText: 'Texto nuevo para el Artículo 3.',
        confidence: 1.0,
        evidence: 'test',
        needsReview: false,
      },
      {
        type: 'DELETE',
        targetId: 'ART_4',
        targetLabel: 'Artículo 4',
        confidence: 1.0,
        evidence: 'test',
        needsReview: false,
      },
    ]);

    expect(report.applied).toHaveLength(2);
    expect(report.consolidatedText).toContain('Texto nuevo para el Artículo 3');
    expect(report.consolidatedText).not.toContain('quinientos dólares');
  });
});

// ─── LegalComparatorService (integration) ─────────────────────────────────────

describe('LegalComparatorService (integration)', () => {
  let comparator: LegalComparatorService;

  beforeEach(async () => {
    // Set engine enabled for tests
    process.env.LEGAL_PATCH_ENGINE_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiffService,
        LawParserService,
        ModeClassifierService,
        PatchExtractorService,
        PatchApplierService,
        LocalizedDiffService,
        LegalComparatorService,
      ],
    }).compile();

    comparator = module.get(LegalComparatorService);
  });

  afterEach(() => {
    delete process.env.LEGAL_PATCH_ENGINE_ENABLED;
  });

  it('PATCH mode: produces consolidatedText with changes applied', async () => {
    const modifier = `
ARTÍCULO 1 — Enmienda
Enmiéndase el Artículo 4 para que lea como sigue:
"El incumplimiento conllevará una multa de mil dólares ($1,000.00)."
`.trim();

    const result = await comparator.compare(BASE_LAW, modifier);

    expect(result.mode).toBe(ComparisonMode.PATCH);
    expect(result.consolidatedText).toBeDefined();
    expect(result.consolidatedText).toContain('$1,000.00');
    expect(result.patchReport).toBeDefined();
    expect(result.impactScore).toBeGreaterThan(0);
  });

  it('FULL mode: override forces FULL even with small modifier', async () => {
    const modifier = 'Derógase el Artículo 2.';
    const result = await comparator.compare(BASE_LAW, modifier, ComparisonMode.FULL);

    expect(result.mode).toBe(ComparisonMode.FULL);
    expect(result.operations).toBeUndefined();
  });

  it('engine disabled: returns stub FULL result', async () => {
    process.env.LEGAL_PATCH_ENGINE_ENABLED = 'false';
    const modifier = 'Derógase el Artículo 2.';
    const result = await comparator.compare(BASE_LAW, modifier);

    expect(result.mode).toBe(ComparisonMode.FULL);
    expect(result.modeClassification.triggers).toContain('engine_disabled');
  });

  it('PATCH mode: affectedUnits contains changed articles', async () => {
    const modifier = `
ARTÍCULO 1
Derógase el Artículo 5 de la presente ley.
`.trim();

    const result = await comparator.compare(BASE_LAW, modifier);

    if (result.mode === ComparisonMode.PATCH) {
      expect(result.affectedUnits).toBeDefined();
      // Should have at least one deleted unit
      const deleted = result.affectedUnits.filter((u) => u.changeKind === 'deleted');
      expect(deleted.length).toBeGreaterThanOrEqual(1);
    }
  });
});
