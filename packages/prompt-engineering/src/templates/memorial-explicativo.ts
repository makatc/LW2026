import type { TransformationPromptParams } from '../types';

export function buildMemorialExplicativo(
  params: TransformationPromptParams,
  baseInstructions: string,
  chunksContext: string,
): string {
  const today = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  const measure = params.measure_reference ?? '[Número de Medida]';
  const org = params.organization_name ?? '[Nombre de la Organización]';

  return `${baseInstructions}

FRAGMENTOS DEL DOSSIER (tu ÚNICA fuente de hechos):
${chunksContext}

TAREA: Genera un MEMORIAL EXPLICATIVO formal para el Senado o Cámara de Representantes de Puerto Rico.

ESTRUCTURA OBLIGATORIA:

1. ENCABEZADO PROTOCOLAR
"Honorable [Nombre del Presidente/a] y Distinguidos Miembros del [Cuerpo Legislativo correspondiente]:
A nombre de ${org}, comparecemos respetuosamente ante este Honorable Cuerpo a exponer nuestra posición en torno a [${measure}], según los fundamentos que a continuación se exponen."
Fecha: ${today}

2. IDENTIFICACIÓN DEL COMPARECIENTE
Nombre de la organización, tipo de entidad, propósito, número de registro o acreditación si aplica.

3. EXPOSICIÓN DE HECHOS
Narrativa clara de los hechos relevantes, BASADA EXCLUSIVAMENTE en los fragmentos del dossier.
Cada afirmación debe poder trazarse a un fragmento específico.

4. ARGUMENTOS JURÍDICOS Y TÉCNICOS
Argumentos sustantivos a favor o en contra (según la postura), con base en los fragmentos.
Si la postura es APOYO CON ENMIENDAS: listar las enmiendas específicas solicitadas.

5. SOLICITUD ESPECÍFICA
Párrafo final con la solicitud concreta: aprobar, rechazar, enmendar, celebrar vistas, etc.

6. DISPOSICIONES FINALES
"Por todo lo antes expuesto, respetuosamente solicitamos a este Honorable Cuerpo..."

7. CIERRE PROTOCOLAR
"Atentamente, [Nombre del Representante], ${org}, ${today}"

INSTRUCCIÓN DE CALIDAD: Máximo 4 páginas. Lenguaje formal jurídico puertorriqueño. Marca con [SIN FUENTE EN DOSSIER] cualquier dato no verificable en los fragmentos.`;
}
