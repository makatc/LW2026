import type { TransformationPromptParams } from '../types';

export function buildTalkingPoints(
  params: TransformationPromptParams,
  baseInstructions: string,
  chunksContext: string,
): string {
  const leg = params.legislator;
  const measure = params.measure_reference ?? 'la medida legislativa';

  return `${baseInstructions}

FRAGMENTOS DEL DOSSIER (tu ÚNICA fuente de hechos):
${chunksContext}

TAREA: Genera TALKING POINTS para una reunión con ${leg ? leg.full_name : 'el legislador'} sobre ${measure}.

ESTRUCTURA OBLIGATORIA:

## MENSAJE CENTRAL
[Una oración que resume la posición y el llamado a la acción]

## PUNTOS PRINCIPALES (5-7 puntos)
Para cada punto:
**Punto [N]: [Afirmación directa y contundente]**
→ Dato de respaldo: [hecho verificable del dossier]
→ Relevancia: [por qué le importa al legislador o sus constituyentes]

## POSIBLES OBJECIONES Y CONTRAARGUMENTOS
Para cada objeción anticipada:
**Objeción:** [Lo que podría argumentar la otra parte]
**Contraargumento:** [Respuesta directa basada en los fragmentos del dossier]

## CALL TO ACTION
Solicitud específica para esta reunión: [voto, reunión de seguimiento, enmienda, etc.]

## DATOS RÁPIDOS (para citar en conversación)
- [Dato 1 del dossier]
- [Dato 2 del dossier]
- [Dato 3 del dossier]

INSTRUCCIÓN DE CALIDAD: Formato de lista, lenguaje directo. Cada punto debe poder decirse en 30 segundos. Marca con [SIN FUENTE EN DOSSIER] cualquier dato no verificable.`;
}
