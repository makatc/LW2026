export type TransformationType =
  | 'memorial_explicativo'
  | 'carta_legislador'
  | 'talking_points'
  | 'testimonio'
  | 'resumen_ejecutivo'
  | 'personalizado';

export type ClientStance = 'apoyo' | 'oposicion' | 'apoyo_con_enmiendas' | 'neutral';

export type ToneProfile =
  | 'formal_juridico'
  | 'ejecutivo_corporativo'
  | 'tecnico_regulatorio'
  | string;

export interface ChunkContext {
  id: string;
  content: string;
  chunk_type: string;
  section_reference?: string;
  page_number?: number;
}

export interface LegislatorProfile {
  id: string;
  full_name: string;
  party?: string;
  chamber: 'upper' | 'lower';
  thematic_footprint?: string;
  topic_positions?: Record<string, string>;
  key_priorities?: string[];
}

export interface TransformationPromptParams {
  transformation_type: TransformationType;
  chunks: ChunkContext[];
  client_stance: ClientStance;
  tone_profile?: ToneProfile;
  legislator?: LegislatorProfile;
  custom_instructions?: string;
  organization_name?: string;
  measure_reference?: string;
}

export interface BuildPromptResult {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
}
