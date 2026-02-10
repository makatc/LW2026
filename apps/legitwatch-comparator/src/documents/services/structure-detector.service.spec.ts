import { Test, TestingModule } from '@nestjs/testing';
import { StructureDetectorService } from './structure-detector.service';
import { DocumentChunkType } from '../../entities';

describe('StructureDetectorService', () => {
  let service: StructureDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StructureDetectorService],
    }).compile();

    service = module.get<StructureDetectorService>(StructureDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectStructure', () => {
    it('should detect articles with standard format', () => {
      const text = `ARTÍCULO 1. OBJETO
La presente ley tiene por objeto regular...

ARTÍCULO 2. ÁMBITO DE APLICACIÓN
Esta ley se aplicará a...`;

      const chunks = service.detectStructure(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe(DocumentChunkType.ARTICLE);
      expect(chunks[0].label).toBe('Artículo 1');
      expect(chunks[0].content).toContain('OBJETO');
      expect(chunks[1].type).toBe(DocumentChunkType.ARTICLE);
      expect(chunks[1].label).toBe('Artículo 2');
    });

    it('should detect articles with "Art." abbreviation', () => {
      const text = `Art. 5. Contenido del artículo 5`;

      const chunks = service.detectStructure(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe(DocumentChunkType.ARTICLE);
      expect(chunks[0].label).toBe('Artículo 5');
    });

    it('should detect chapters', () => {
      const text = `CAPÍTULO I. DISPOSICIONES GENERALES
Contenido del capítulo...

CAPÍTULO II. OBLIGACIONES
Más contenido...`;

      const chunks = service.detectStructure(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe(DocumentChunkType.CHAPTER);
      expect(chunks[0].label).toBe('Capítulo I');
      expect(chunks[1].type).toBe(DocumentChunkType.CHAPTER);
      expect(chunks[1].label).toBe('Capítulo II');
    });

    it('should detect sections', () => {
      const text = `SECCIÓN 1. Primera Sección
Contenido...

SECCIÓN II. Segunda Sección
Más contenido...`;

      const chunks = service.detectStructure(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe(DocumentChunkType.SECTION);
      expect(chunks[0].label).toBe('Sección 1');
      expect(chunks[1].type).toBe(DocumentChunkType.SECTION);
      expect(chunks[1].label).toBe('Sección II');
    });

    it('should handle mixed article and section markers', () => {
      const text = `CAPÍTULO I. INTRODUCCIÓN

ARTÍCULO 1. DEFINICIONES
Contenido del artículo 1...

ARTÍCULO 2. PRINCIPIOS
Contenido del artículo 2...`;

      const chunks = service.detectStructure(text);

      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks[0].type).toBe(DocumentChunkType.CHAPTER);
      expect(chunks[1].type).toBe(DocumentChunkType.ARTICLE);
      expect(chunks[2].type).toBe(DocumentChunkType.ARTICLE);
    });

    it('should handle empty or whitespace-only text', () => {
      const emptyChunks = service.detectStructure('');
      expect(emptyChunks).toHaveLength(0);

      const whitespaceChunks = service.detectStructure('   \n  \n  ');
      expect(whitespaceChunks).toHaveLength(0);
    });

    it('should preserve content after structural markers', () => {
      const text = `ARTÍCULO 1. DEFINICIONES
Para los efectos de esta ley:
a) Dato personal: información de personas.
b) Tratamiento: operaciones sobre datos.`;

      const chunks = service.detectStructure(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Para los efectos de esta ley');
      expect(chunks[0].content).toContain('a) Dato personal');
      expect(chunks[0].content).toContain('b) Tratamiento');
    });

    it('should handle text with no structural markers as paragraphs', () => {
      const text = `Este es un texto sin marcadores estructurales.
Simplemente contenido libre.
Más texto aquí.`;

      const chunks = service.detectStructure(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((c) => c.type === DocumentChunkType.PARAGRAPH)).toBe(true);
    });
  });

  describe('validateStructure', () => {
    it('should validate when chunks are reasonable', () => {
      const chunks = [
        {
          type: DocumentChunkType.ARTICLE,
          label: 'Artículo 1',
          content: 'This is substantial content for the article with enough characters.',
          orderIndex: 0,
          startPosition: 0,
          endPosition: 100,
        },
      ];

      const result = service.validateStructure(chunks);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect empty chunks', () => {
      const chunks = [
        {
          type: DocumentChunkType.ARTICLE,
          label: 'Artículo 1',
          content: '',
          orderIndex: 0,
          startPosition: 0,
          endPosition: 10,
        },
      ];

      const result = service.validateStructure(chunks);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('empty content'))).toBe(true);
    });

    it('should detect when no chunks are found', () => {
      const result = service.validateStructure([]);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('No structural elements'))).toBe(true);
    });

    it('should detect suspiciously short content', () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        type: DocumentChunkType.ARTICLE,
        label: `Artículo ${i + 1}`,
        content: 'short',
        orderIndex: i,
        startPosition: i * 10,
        endPosition: (i + 1) * 10,
      }));

      const result = service.validateStructure(chunks);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('suspiciously short'))).toBe(true);
    });
  });
});
