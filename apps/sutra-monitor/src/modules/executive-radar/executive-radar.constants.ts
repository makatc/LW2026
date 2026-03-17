// FUENTE: Portales verificados 2026-03-17
export const EXECUTIVE_RADAR_CONSTANTS = {
  ESTADO_PR_URL: 'https://estado.pr.gov/ordenes-ejecutivas',
  FORTALEZA_PR_URL: 'https://fortaleza.pr.gov/ordenes-ejecutivas',
  DOCS_PR_BASE: 'https://docs.pr.gov/files/Estado/OrdenesEjecutivas',
  SCRAPE_CRON: '0 6 * * *', // 2:00 AM PR = 6:00 AM UTC
  VALID_SECTORS: ['energy', 'permits', 'health', 'education', 'fiscal', 'labor', 'housing', 'environment', 'infrastructure', 'other'],
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
} as const;

export type ValidSector = typeof EXECUTIVE_RADAR_CONSTANTS.VALID_SECTORS[number];
