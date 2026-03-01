export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    // Replace any non-alphanumeric char with space (keep a-z, 0-9)
    .replace(/[^a-z0-9]+/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
