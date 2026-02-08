import { createHash } from 'crypto';

export function calculateHash(content: object | string): string {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return createHash('sha256').update(str).digest('hex');
}
