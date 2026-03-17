// FUENTE: URLs de portales gubernamentales de Puerto Rico
// Verificadas: 2026-03-17

export const FISCAL_SOURCES = {
  OGP_BASE_URL: 'https://bvirtualogp.pr.gov',
  OGP_MEASURES_PATH: '/Medidas%20Legislativas/',
  HACIENDA_BASE_URL: 'https://hacienda.pr.gov',
  HACIENDA_MEMORIALES_PATH: '/sala-de-prensa/memoriales-y-ponencias-legislativas',
  FOMB_BASE_URL: 'https://oversightboard.pr.gov',
  FOMB_LEGISLATIVE_PATH: '/legislative-process/',
} as const;

export const AGENCY_NAMES = {
  OGP: 'OGP',
  HACIENDA: 'Hacienda',
  JUSTICIA: 'Justicia',
  SALUD: 'Salud',
  FOMB: 'FOMB',
} as const;

export type AgencyName = typeof AGENCY_NAMES[keyof typeof AGENCY_NAMES];

export const BILL_NUMBER_PATTERN = /(?:P\.\s*de\s*la\s*[CS]\.?|P\.\s*del\s*[CS]\.?|R\.C\.|R\.S\.|R\.\s*de\s*la\s*[CS]\.?|R\.\s*del\s*[CS]\.?)\s*(\d+)/gi;

export const LAW_NUMBER_PATTERN = /Ley\s+(\d+)-(\d{4})/gi;
