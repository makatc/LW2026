import type { TransformationPromptParams } from '../types';

export function buildResumenEjecutivo(
  params: TransformationPromptParams,
  baseInstructions: string,
  chunksContext: string,
): string {
  const today = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  const measure = params.measure_reference ?? 'la medida legislativa';

  return `${baseInstructions}

FRAGMENTOS DEL DOSSIER (tu ÚNICA fuente de hechos):
${chunksContext}

TAREA: Genera un RESUMEN EJECUTIVO de máximo 1 página para junta directiva sobre ${measure}.

ESTRUCTURA OBLIGATORIA (máximo 400 palabras en total):

**PARA:** Junta Directiva / Equipo Ejecutivo
**DE:** [Departamento de Asuntos Legislativos]
**FECHA:** ${today}
**RE:** ${measure}

---

**1. QUÉ ES**
[2-3 oraciones máximo. ¿Qué hace esta medida? Sin jerga legal. Como si se lo explicaras a alguien sin formación jurídica.]

**2. IMPACTO EN NUESTRA ORGANIZACIÓN**
[3-5 bullets concisos con los efectos más importantes SEGÚN EL DOSSIER]
• [Impacto 1]
• [Impacto 2]
• [Impacto 3]

**3. POSICIÓN RECOMENDADA**
[Una oración directa: Apoyo / Oposición / Apoyo con enmiendas / Neutral]
[1-2 oraciones explicando la razón principal.]

**4. ACCIONES EN CURSO**
[Bullets con qué se está haciendo: comparecencia, carta, reunión, etc.]
• [Acción 1]
• [Acción 2]

---

INSTRUCCIÓN DE CALIDAD: Lenguaje ejecutivo, no jurídico. Orientado a decisión. Sin tecnicismos. Máximo 1 página. Marca con [SIN FUENTE EN DOSSIER] cualquier dato no verificable.`;
}
