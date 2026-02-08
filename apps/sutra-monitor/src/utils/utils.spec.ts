import { normalizeText, calculateHash } from '@lwbeta/utils';

describe('Utils - normalizeText', () => {
    it('should convert to lowercase', () => {
        expect(normalizeText('HELLO WORLD')).toBe('hello world');
    });

    it('should remove accents', () => {
        expect(normalizeText('café')).toBe('cafe');
        expect(normalizeText('niño')).toBe('nino');
        expect(normalizeText('José')).toBe('jose');
    });

    it('should remove special characters', () => {
        expect(normalizeText('hello-world!')).toBe('hello world');
        expect(normalizeText('test@example.com')).toBe('test example com');
    });

    it('should handle multiple spaces', () => {
        expect(normalizeText('hello    world')).toBe('hello world');
    });

    it('should handle empty strings', () => {
        expect(normalizeText('')).toBe('');
    });

    it('should handle complex text', () => {
        const input = 'P. del S. 1420 - Regulación de IA';
        const output = normalizeText(input);
        expect(output).toBe('p del s 1420 regulacion de ia');
    });
});

describe('Utils - calculateHash', () => {
    it('should generate consistent hash for same input', () => {
        const input = { numero: 'P. del S. 1420', titulo: 'Test' };
        const hash1 = calculateHash(input);
        const hash2 = calculateHash(input);
        expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
        const input1 = { numero: 'P. del S. 1420' };
        const input2 = { numero: 'P. del S. 1421' };
        const hash1 = calculateHash(input1);
        const hash2 = calculateHash(input2);
        expect(hash1).not.toBe(hash2);
    });

    it('should handle complex objects', () => {
        const input = {
            numero: 'P. del S. 1420',
            titulo: 'Regulación de IA',
            extracto: 'Lorem ipsum...',
            commission: 'Comisión de Tecnología'
        };
        const hash = calculateHash(input);
        expect(hash).toBeDefined();
        expect(hash.length).toBeGreaterThan(0);
    });

    it('should be sensitive to property order', () => {
        // Note: JSON.stringify is order-sensitive
        const input1 = { a: 1, b: 2 };
        const input2 = { b: 2, a: 1 };
        const hash1 = calculateHash(input1);
        const hash2 = calculateHash(input2);
        // They should be different because property order matters in JSON.stringify
        expect(hash1).not.toBe(hash2);
    });
});
