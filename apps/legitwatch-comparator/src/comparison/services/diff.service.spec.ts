import { Test, TestingModule } from '@nestjs/testing';
import { DiffService } from './diff.service';

describe('DiffService', () => {
  let service: DiffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiffService],
    }).compile();

    service = module.get<DiffService>(DiffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDiff', () => {
    it('should generate diff with insertions and deletions', () => {
      const oldText = 'El artículo establece que el ciudadano deberá cumplir.';
      const newText = 'El artículo establece que el ciudadano podrá cumplir.';

      const result = service.generateDiff(oldText, newText);

      expect(result).toBeDefined();
      expect(result.htmlDiff).toContain('del');
      expect(result.htmlDiff).toContain('ins');
      // The diff algorithm finds minimal changes at character level
      expect(result.htmlDiff).toContain('debe');
      expect(result.htmlDiff).toContain('pod');
      expect(result.changePercentage).toBeGreaterThan(0);
    });

    it('should return no diff for identical texts', () => {
      const text = 'Este es un texto sin cambios.';

      const result = service.generateDiff(text, text);

      expect(result.addedChars).toBe(0);
      expect(result.deletedChars).toBe(0);
      expect(result.changePercentage).toBe(0);
    });

    it('should handle empty strings', () => {
      const result = service.generateDiff('', '');

      expect(result.addedChars).toBe(0);
      expect(result.deletedChars).toBe(0);
      expect(result.changePercentage).toBe(0);
    });

    it('should detect additions', () => {
      const oldText = 'Texto original.';
      const newText = 'Texto original con adición.';

      const result = service.generateDiff(oldText, newText);

      expect(result.addedChars).toBeGreaterThan(0);
      expect(result.deletedChars).toBe(0);
      expect(result.htmlDiff).toContain('ins');
    });

    it('should detect deletions', () => {
      const oldText = 'Texto original completo.';
      const newText = 'Texto original.';

      const result = service.generateDiff(oldText, newText);

      expect(result.addedChars).toBe(0);
      expect(result.deletedChars).toBeGreaterThan(0);
      expect(result.htmlDiff).toContain('del');
    });

    it('should calculate change percentage correctly', () => {
      const oldText = 'AAAA';
      const newText = 'BBBB';

      const result = service.generateDiff(oldText, newText);

      // All 4 chars deleted, all 4 chars added = 8 changes / 4 total = 200%
      expect(result.changePercentage).toBe(200);
      expect(result.addedChars).toBe(4);
      expect(result.deletedChars).toBe(4);
    });
  });

  describe('generateSideBySideDiff', () => {
    it('should generate separate old and new HTML', () => {
      const oldText = 'Texto original con palabra eliminada.';
      const newText = 'Texto original con palabra agregada.';

      const result = service.generateSideBySideDiff(oldText, newText);

      expect(result.oldHtml).toBeDefined();
      expect(result.newHtml).toBeDefined();
      expect(result.oldHtml).toContain('del');
      // Character-level diff finds "elimin" as deletion
      expect(result.oldHtml).toContain('elimin');
      expect(result.newHtml).toContain('ins');
      // Character-level diff finds "agreg" as insertion
      expect(result.newHtml).toContain('agreg');
    });

    it('should handle identical texts in side-by-side', () => {
      const text = 'Texto sin cambios';

      const result = service.generateSideBySideDiff(text, text);

      expect(result.oldHtml).toBe(text);
      expect(result.newHtml).toBe(text);
      expect(result.oldHtml).not.toContain('del');
      expect(result.newHtml).not.toContain('ins');
    });
  });

  describe('areSimilar', () => {
    it('should detect identical texts as similar', () => {
      const text = 'Texto idéntico';

      expect(service.areSimilar(text, text)).toBe(true);
    });

    it('should detect very similar texts as similar', () => {
      const text1 = 'El artículo establece el procedimiento.';
      const text2 = 'El artículo establece el procedimiento general.';

      // Default threshold is 0.7
      expect(service.areSimilar(text1, text2, 0.7)).toBe(true);
    });

    it('should detect completely different texts as not similar', () => {
      const text1 = 'AAAA';
      const text2 = 'BBBB';

      expect(service.areSimilar(text1, text2)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(service.areSimilar('', '')).toBe(true);
      expect(service.areSimilar('text', '')).toBe(false);
      expect(service.areSimilar('', 'text')).toBe(false);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 100 for identical texts', () => {
      const text = 'Texto idéntico';

      expect(service.calculateSimilarity(text, text)).toBe(100);
    });

    it('should return 0 for empty strings', () => {
      expect(service.calculateSimilarity('text', '')).toBe(0);
      expect(service.calculateSimilarity('', 'text')).toBe(0);
    });

    it('should return intermediate value for similar texts', () => {
      const text1 = 'ABCD';
      const text2 = 'ABCE';

      const similarity = service.calculateSimilarity(text1, text2);

      expect(similarity).toBeGreaterThan(50);
      expect(similarity).toBeLessThan(100);
    });

    it('should return low value for very different texts', () => {
      const text1 = 'AAAA';
      const text2 = 'BBBB';

      const similarity = service.calculateSimilarity(text1, text2);

      expect(similarity).toBeLessThan(50);
    });
  });
});
