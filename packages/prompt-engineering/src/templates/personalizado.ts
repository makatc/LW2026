import type { TransformationPromptParams } from '../types';

export function buildPersonalizado(
  params: TransformationPromptParams,
  baseInstructions: string,
  chunksContext: string,
): string {
  return `${baseInstructions}

FRAGMENTOS DEL DOSSIER (tu ÚNICA fuente de hechos):
${chunksContext}

TAREA: Genera el documento según las instrucciones específicas proporcionadas por el cliente.
${params.custom_instructions ? `\nINSTRUCCIONES DEL CLIENTE:\n${params.custom_instructions}` : '\nNo se proporcionaron instrucciones específicas. Genera un documento general de advocacy basado en los fragmentos del dossier.'}

INSTRUCCIÓN DE CALIDAD: Estructura el contenido de manera profesional y coherente. Marca con [SIN FUENTE EN DOSSIER] cualquier dato no verificable en los fragmentos proporcionados.`;
}
