import type { TransformationPromptParams } from '../types';

export function buildTestimonio(
  params: TransformationPromptParams,
  baseInstructions: string,
  chunksContext: string,
): string {
  const today = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  const measure = params.measure_reference ?? '[Medida Legislativa]';
  const org = params.organization_name ?? '[Nombre de la Organización]';

  return `${baseInstructions}

FRAGMENTOS DEL DOSSIER (tu ÚNICA fuente de hechos):
${chunksContext}

TAREA: Genera un TESTIMONIO para Vista Pública del Capitolio de Puerto Rico sobre ${measure}.

ESTRUCTURA OBLIGATORIA:

1. PROTOCOLO DE APERTURA
"Honorable Presidente/a y distinguidos miembros de este Comité:
Buenos días/tardes. Me llamo [Nombre], [Cargo] de ${org}. Comparezco ante este Honorable Cuerpo para expresar nuestra posición en torno a [${measure}]."

2. IDENTIFICACIÓN DEL DECLARANTE Y ORGANIZACIÓN
Quiénes somos, qué hacemos, a quiénes representamos.

3. PROPÓSITO DE LA COMPARECENCIA
Párrafo de contexto: por qué comparece esta organización y cuál es su relación con la medida.

4. CUERPO DEL TESTIMONIO
3-4 argumentos técnicos y legales, BASADOS EXCLUSIVAMENTE en los fragmentos del dossier.
Postura definida: ${params.client_stance}.
Incluir impactos concretos si están disponibles en el dossier.

5. SOLICITUD ESPECÍFICA AL COMITÉ
"Por las razones antes expuestas, respetuosamente solicitamos a este Honorable Comité que [apruebe / rechace / enmiende] [${measure}] por las siguientes razones: [lista breve]."

6. AGRADECIMIENTO Y CIERRE
"Agradecemos la oportunidad de comparecer ante este Honorable Comité. Quedamos disponibles para responder cualquier pregunta. Gracias."

INSTRUCCIÓN DE CALIDAD: 3-5 minutos de lectura oral (750-1,250 palabras). Lenguaje claro y formal. Marca con [SIN FUENTE EN DOSSIER] cualquier dato no verificable en los fragmentos.`;
}
