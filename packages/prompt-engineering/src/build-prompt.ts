import type { TransformationPromptParams, BuildPromptResult } from './types';
import { buildMemorialExplicativo } from './templates/memorial-explicativo';
import { buildCartaLegislador } from './templates/carta-legislador';
import { buildTalkingPoints } from './templates/talking-points';
import { buildTestimonio } from './templates/testimonio';
import { buildResumenEjecutivo } from './templates/resumen-ejecutivo';
import { buildPersonalizado } from './templates/personalizado';
import { buildBaseInstructions } from './templates/base-instructions';

export function buildTransformationPrompt(params: TransformationPromptParams): BuildPromptResult {
  const baseInstructions = buildBaseInstructions(params);
  const chunksContext = formatChunks(params.chunks);

  let templatePrompt: string;
  switch (params.transformation_type) {
    case 'memorial_explicativo':
      templatePrompt = buildMemorialExplicativo(params, baseInstructions, chunksContext);
      break;
    case 'carta_legislador':
      templatePrompt = buildCartaLegislador(params, baseInstructions, chunksContext);
      break;
    case 'talking_points':
      templatePrompt = buildTalkingPoints(params, baseInstructions, chunksContext);
      break;
    case 'testimonio':
      templatePrompt = buildTestimonio(params, baseInstructions, chunksContext);
      break;
    case 'resumen_ejecutivo':
      templatePrompt = buildResumenEjecutivo(params, baseInstructions, chunksContext);
      break;
    case 'personalizado':
    default:
      templatePrompt = buildPersonalizado(params, baseInstructions, chunksContext);
  }

  const systemPrompt = `Eres un experto en legislación y cabildeo legislativo de Puerto Rico. Generas documentos formales de alta calidad.

REGLA ABSOLUTA DE FUNDAMENTACIÓN:
Solo puedes incluir hechos, cifras, y argumentos que estén EXPLÍCITAMENTE presentes en los fragmentos documentales proporcionados.
Si necesitas incluir información que NO está en los fragmentos, debes marcarla con [SIN FUENTE EN DOSSIER].
Nunca uses conocimiento paramétrico externo para afirmar hechos sobre la legislación en cuestión.

Responde en español formal puertorriqueño.`;

  return {
    systemPrompt,
    userPrompt: templatePrompt,
    fullPrompt: `${systemPrompt}\n\n${templatePrompt}`,
  };
}

function formatChunks(chunks: Array<{ id: string; content: string; chunk_type: string; section_reference?: string; page_number?: number }>): string {
  if (chunks.length === 0) {
    return 'No se proporcionaron fragmentos documentales.';
  }
  return chunks
    .map(
      (c, i) =>
        `--- FRAGMENTO ${i + 1} [id: ${c.id}] ---
Tipo: ${c.chunk_type}
Sección: ${c.section_reference ?? 'N/A'}
Página: ${c.page_number ?? 'N/A'}

${c.content}`,
    )
    .join('\n\n');
}
