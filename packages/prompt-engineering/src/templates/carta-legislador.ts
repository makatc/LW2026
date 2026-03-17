import type { TransformationPromptParams } from '../types';

export function buildCartaLegislador(
  params: TransformationPromptParams,
  baseInstructions: string,
  chunksContext: string,
): string {
  const today = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  const leg = params.legislator;
  const chamber = leg?.chamber === 'upper' ? 'Senado' : 'Cámara de Representantes';
  const honorific = leg?.chamber === 'upper' ? 'Honorable Senador/a' : 'Honorable Representante';
  const measure = params.measure_reference ?? '[Medida Legislativa]';
  const org = params.organization_name ?? '[Nombre de la Organización]';

  return `${baseInstructions}

FRAGMENTOS DEL DOSSIER (tu ÚNICA fuente de hechos):
${chunksContext}

TAREA: Genera una CARTA FORMAL AL LEGISLADOR/A con la siguiente estructura:

1. ENCABEZADO
${today}

${honorific} ${leg?.full_name ?? '[Nombre del Legislador/a]'}
${chamber} de Puerto Rico
Capitolio de Puerto Rico
San Juan, Puerto Rico

2. SALUDO FORMAL
"Estimado/a ${honorific} ${leg?.full_name?.split(' ')[0] ?? '[Apellido]'}:"

3. PÁRRAFO DE APERTURA
Identificación del remitente (${org}) y propósito de la carta en relación a ${measure}.
${leg?.thematic_footprint ? `Si aplica, hacer referencia al historial del legislador en temas relacionados: ${leg.thematic_footprint}` : ''}

4. ARGUMENTOS CENTRALES
2-3 párrafos con los argumentos más importantes, basados EXCLUSIVAMENTE en los fragmentos del dossier.
Adaptar el argumento a la postura: ${params.client_stance}.

5. SOLICITUD ESPECÍFICA (Call to Action)
Un párrafo directo solicitando: voto favorable/desfavorable, reunión de trabajo, consideración de enmienda, etc.

6. CIERRE
"Quedamos a su disposición para cualquier información adicional que requiera.
Respetuosamente,
[Nombre del Firmante]
[Cargo]
${org}"

INSTRUCCIÓN DE CALIDAD: Máximo 1 página. Tono directo pero respetuoso. Personaliza según el perfil del legislador si está disponible.`;
}
