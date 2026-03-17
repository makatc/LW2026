import type { TransformationPromptParams } from '../types';

const STANCE_MAP = {
  apoyo: 'APOYO — Argumenta firmemente a favor de esta medida. Presenta los beneficios y razones para su aprobación.',
  oposicion: 'OPOSICIÓN — Argumenta firmemente en contra de esta medida. Presenta los perjuicios y razones para su rechazo.',
  apoyo_con_enmiendas: 'APOYO CON ENMIENDAS — Apoya el propósito de la medida pero solicita modificaciones específicas. Señala qué debe cambiarse.',
  neutral: 'NEUTRAL — Presenta los hechos de manera objetiva. No tomes posición. Informa sin advocacy.',
};

const TONE_MAP: Record<string, string> = {
  formal_juridico: 'Tono formal jurídico: usa terminología legal precisa, cita disposiciones cuando corresponda, lenguaje protocolar y solemne.',
  ejecutivo_corporativo: 'Tono ejecutivo corporativo: conciso, orientado a impacto de negocio y decisión, profesional pero directo.',
  tecnico_regulatorio: 'Tono técnico regulatorio: enfocado en cumplimiento, precedentes regulatorios, y estándares de la industria.',
};

export function buildBaseInstructions(params: TransformationPromptParams): string {
  const stance = STANCE_MAP[params.client_stance];
  const tone = params.tone_profile ? (TONE_MAP[params.tone_profile] ?? `Tono: ${params.tone_profile}`) : '';

  const legislatorSection = params.legislator
    ? `PERFIL DEL LEGISLADOR OBJETIVO:
Nombre: ${params.legislator.full_name}
Partido: ${params.legislator.party ?? 'No especificado'}
Cámara: ${params.legislator.chamber === 'upper' ? 'Senado' : 'Cámara de Representantes'}
${params.legislator.thematic_footprint ? `Enfoque temático: ${params.legislator.thematic_footprint}` : ''}
${params.legislator.key_priorities?.length ? `Prioridades conocidas: ${params.legislator.key_priorities.join(', ')}` : ''}
${params.legislator.topic_positions ? `Posiciones en temas: ${JSON.stringify(params.legislator.topic_positions)}` : ''}`
    : '';

  const customSection = params.custom_instructions
    ? `INSTRUCCIONES ESPECÍFICAS DEL CLIENTE:\n${params.custom_instructions}`
    : '';

  return [
    `POSTURA DEL CLIENTE: ${stance}`,
    tone,
    legislatorSection,
    customSection,
  ]
    .filter(Boolean)
    .join('\n\n');
}
