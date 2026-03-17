// FUENTE: bvirtualogp.pr.gov — Biblioteca Virtual OGP
// Portales gubernamentales verificados 2026-03-17
export const CONTRACT_ANALYZER_CONSTANTS = {
  BVIRTUALOGP_URL: 'https://bvirtualogp.pr.gov',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  GEMINI_EMBEDDING_URL: 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent',
  EMBEDDING_DIMENSIONS: 768,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ANALYSIS_QUEUE: 'contract-analysis-queue',
  CORPUS_SYNC_CRON: '0 7 * * 0', // Sundays 3:00 AM PR = 7:00 AM UTC

  // Priority laws for PR contractual conflict detection
  PRIORITY_LAWS: [
    {
      number: 'Ley 80-1976',
      title: 'Ley de Indemnización por Despido Injustificado',
      url: 'https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Laboral/80-1976.pdf',
    },
    {
      number: 'Ley 100-1959',
      title: 'Ley contra el Discrimen en el Empleo',
      url: 'https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Laboral/100-1959.pdf',
    },
    {
      number: 'Ley 115-1991',
      title: 'Ley de Represalias',
      url: 'https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Laboral/115-1991.pdf',
    },
    {
      number: 'Ley 379-1948',
      title: 'Ley de Horas y Días de Trabajo',
      url: 'https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Laboral/379-1948.pdf',
    },
    {
      number: 'Ley 76-1964',
      title: 'Ley de Arrendamientos Comerciales',
      url: 'https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Propiedad/76-1964.pdf',
    },
  ],

  // Disclaimer - MANDATORY in all contract reports
  LEGAL_DISCLAIMER:
    'Este análisis es una herramienta de apoyo. Las determinaciones legales finales deben ser validadas por un abogado autorizado a ejercer en Puerto Rico.',
} as const;
