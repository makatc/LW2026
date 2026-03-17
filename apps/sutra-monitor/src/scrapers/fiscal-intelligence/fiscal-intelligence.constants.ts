// FUENTE: Portales gubernamentales de Puerto Rico verificados el 2026-03-17
// Selectores CSS y patrones pueden cambiar si el gobierno actualiza sus portales

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
} as const;

// Regex para extraer número de medida del texto del documento
// Ej: "P. de la C. 413", "P. del S. 77", "R.C. 120"
export const BILL_NUMBER_PATTERN = /(?:P\.?\s*de\s*la\s*[CS]\.?|P\.?\s*del?\s*[CS]\.?|R\.?[CS]\.?|R\.?\s*de\s*la\s*[CS]\.?|R\.?\s*del?\s*[CS]\.?)\s*(\d+)/gi;

// Regex para extraer número de ley FOMB: "Ley 224-2024"
export const LAW_NUMBER_PATTERN = /Ley\s+(\d+)-(\d{4})/gi;

// Scraper request config
export const SCRAPER_CONFIG = {
  TIMEOUT_MS: 30_000,
  MAX_RETRIES: 3,
  RETRY_BACKOFF_BASE_MS: 2_000,
} as const;
