import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DossierTransformation, GenerationStatus, TransformationType, ClientStance } from '../../entities/dossier-transformation.entity';
import { DossierChunk } from '../../entities/dossier-chunk.entity';
import { DossierProject } from '../../entities/dossier-project.entity';

const TONE_DESCRIPTIONS: Record<string, string> = {
  formal_juridico: 'Usa lenguaje jurídico formal, preciso y técnico. Cita disposiciones legales cuando corresponda.',
  ejecutivo_corporativo: 'Usa lenguaje ejecutivo corporativo, orientado a decisión y resultados. Conciso y profesional.',
  tecnico_regulatorio: 'Usa lenguaje técnico regulatorio. Enfocado en cumplimiento, procedimientos y estándares.',
};

const STANCE_DESCRIPTIONS: Record<ClientStance, string> = {
  apoyo: 'La postura del cliente es de APOYO a esta medida. Argumenta a favor.',
  oposicion: 'La postura del cliente es de OPOSICIÓN a esta medida. Argumenta en contra.',
  apoyo_con_enmiendas: 'La postura del cliente es de APOYO CON ENMIENDAS. Apoya la medida pero solicita modificaciones específicas.',
  neutral: 'La postura del cliente es NEUTRAL. Presenta los hechos de manera objetiva.',
};

function buildPrompt(
  type: TransformationType,
  chunks: DossierChunk[],
  stance: ClientStance,
  toneProfile?: string,
  legislatorContext?: string,
  customInstructions?: string,
): string {
  const context = chunks
    .map((c) => `[${c.section_reference ?? c.chunk_type}] ${c.content}`)
    .join('\n\n');

  const toneInstructions = toneProfile ? TONE_DESCRIPTIONS[toneProfile] ?? '' : '';
  const stanceInstructions = STANCE_DESCRIPTIONS[stance];

  const baseInstructions = `INSTRUCCIÓN CRÍTICA: Solo usa información de los fragmentos documentales proporcionados. Marca con [SIN FUENTE EN DOSSIER] cualquier afirmación que no puedas verificar en el contexto recibido. No uses conocimiento paramétrico externo.

${stanceInstructions}
${toneInstructions}
${legislatorContext ? `PERFIL DEL LEGISLADOR OBJETIVO:\n${legislatorContext}` : ''}
${customInstructions ? `INSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}

FRAGMENTOS DEL DOSSIER:
${context}`;

  const templates: Record<TransformationType, string> = {
    [TransformationType.MEMORIAL_EXPLICATIVO]: `${baseInstructions}

Genera un MEMORIAL EXPLICATIVO formal para el Senado/Cámara de Puerto Rico con la siguiente estructura:
1. Encabezado protocolar: "Honorable Presidente/Presidenta..." con fecha actual
2. Identificación del compareciente
3. Exposición de hechos (basada EXCLUSIVAMENTE en los fragmentos del dossier)
4. Argumentos jurídicos y técnicos
5. Solicitud específica
6. Disposiciones finales
7. Cierre protocolar formal

Redacta en español formal jurídico puertorriqueño.`,

    [TransformationType.CARTA_LEGISLADOR]: `${baseInstructions}

Genera una CARTA FORMAL AL LEGISLADOR con la siguiente estructura:
1. Fecha y encabezado con datos del legislador
2. Saludo formal
3. Párrafo de apertura (referencia al tema legislativo)
4. Argumentos centrales basados en el dossier
5. Petición específica (voto favorable/desfavorable, reunión, enmienda)
6. Cierre y firma

Personaliza el contenido según el perfil del legislador si está disponible.`,

    [TransformationType.TALKING_POINTS]: `${baseInstructions}

Genera TALKING POINTS estructurados para reunión con legislador:
1. 5-7 puntos principales (afirmación + dato de respaldo del dossier)
2. Sección de posibles objeciones con contraargumento para cada una
3. Mensaje central en una oración
4. Call to action

Formato: listas concisas, legible en reunión presencial.`,

    [TransformationType.TESTIMONIO]: `${baseInstructions}

Genera un TESTIMONIO para Vista Pública del Capitolio de Puerto Rico:
1. Protocolo de apertura: "Honorable Presidente/a y distinguidos miembros del comité..."
2. Identificación del declarante y organización
3. Propósito de la comparecencia
4. Cuerpo del testimonio con argumentos técnicos y legales
5. Solicitud específica al comité
6. Agradecimiento y cierre

Tiempo estimado: 3-5 minutos de lectura oral.`,

    [TransformationType.RESUMEN_EJECUTIVO]: `${baseInstructions}

Genera un RESUMEN EJECUTIVO para junta directiva (máximo 1 página):
1. QUÉ ES: Descripción de la medida en lenguaje no técnico
2. IMPACTO EN NUESTRA ORGANIZACIÓN: Efectos concretos
3. POSICIÓN RECOMENDADA: Recomendación clara
4. ACCIONES EN CURSO: Qué se está haciendo

Lenguaje: ejecutivo, orientado a decisión, sin jerga legal.`,

    [TransformationType.PERSONALIZADO]: `${baseInstructions}

Genera el documento solicitado según las instrucciones adicionales proporcionadas.
Estructura el contenido de manera profesional y coherente.`,

    // ANALISIS_RIESGO_FOMB is handled separately via buildFombRiskPrompt — placeholder here
    [TransformationType.ANALISIS_RIESGO_FOMB]: `${baseInstructions}

Genera un análisis de riesgo FOMB basado en los fragmentos del dossier disponibles.
Identifica posibles conflictos con el Plan Fiscal y recomienda enmiendas.`,
  };

  return templates[type] ?? templates[TransformationType.PERSONALIZADO];
}

@Processor('transformation-queue')
export class TransformationProcessor extends WorkerHost {
  private readonly logger = new Logger(TransformationProcessor.name);

  constructor(
    @InjectRepository(DossierTransformation)
    private readonly transformationRepo: Repository<DossierTransformation>,
    @InjectRepository(DossierChunk)
    private readonly chunkRepo: Repository<DossierChunk>,
    @InjectRepository(DossierProject)
    private readonly projectRepo: Repository<DossierProject>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<{ transformationId: string }>): Promise<void> {
    const { transformationId } = job.data;
    const transformation = await this.transformationRepo.findOne({ where: { id: transformationId } });
    if (!transformation) return;

    try {
      await this.transformationRepo.update(transformationId, {
        generation_status: GenerationStatus.GENERATING,
      });

      // Fetch selected chunks
      const chunks = await this.chunkRepo.findByIds(transformation.selected_chunk_ids);

      let prompt: string;

      if (transformation.transformation_type === TransformationType.ANALISIS_RIESGO_FOMB) {
        prompt = await this.buildFombRiskPrompt(transformation, chunks);
      } else {
        // Get legislator context if available
        let legislatorContext: string | undefined;
        if (transformation.legislator_id) {
          legislatorContext = await this.getLegislatorContext(transformation.legislator_id);
        }

        prompt = buildPrompt(
          transformation.transformation_type,
          chunks,
          transformation.client_stance,
          transformation.tone_profile ?? undefined,
          legislatorContext,
          transformation.custom_instructions ?? undefined,
        );
      }

      const content = await this.callGemini(prompt);

      await this.transformationRepo.update(transformationId, {
        generated_content: content,
        generation_status: GenerationStatus.COMPLETED,
      });

      this.logger.log(`Transformation ${transformationId} completed`);
    } catch (err) {
      this.logger.error(`Transformation ${transformationId} failed: ${err}`);
      await this.transformationRepo.update(transformationId, {
        generation_status: GenerationStatus.ERROR,
      });
    }
  }

  private async buildFombRiskPrompt(
    transformation: DossierTransformation,
    chunks: DossierChunk[],
  ): Promise<string> {
    // Resolve the project's measure_reference to query FOMB actions
    const project = await this.projectRepo.findOne({ where: { id: transformation.project_id } });
    const measureRef = project?.measure_reference?.trim().toUpperCase() ?? null;

    let fombActionData = '[SIN FUENTE EN DOSSIER]';
    let historialFomb = '[SIN FUENTE EN DOSSIER]';

    if (measureRef) {
      // Fetch the most relevant FOMB action for this measure
      try {
        const actions = await this.dataSource.query(
          `SELECT * FROM fomb_actions
           WHERE UPPER(TRIM(law_number)) = $1
              OR UPPER(TRIM(bill_number)) = $1
           ORDER BY action_date DESC NULLS LAST
           LIMIT 1`,
          [measureRef],
        );
        if (actions.length > 0) {
          const a = actions[0];
          fombActionData = [
            a.action_type ? `Tipo: ${a.action_type}` : null,
            a.action_date ? `Fecha: ${a.action_date}` : null,
            a.agency ? `Agencia: ${a.agency}` : null,
            a.amount ? `Monto: ${a.amount}` : null,
            a.description ? `Descripción: ${a.description}` : null,
            a.rationale ? `Razonamiento: ${a.rationale}` : null,
          ]
            .filter(Boolean)
            .join('\n');
        }
      } catch (err) {
        this.logger.warn(`FOMB action query failed: ${err}`);
      }

      // Fetch last 24 months of FOMB actions in the same sector/agency
      try {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 24);
        const historial = await this.dataSource.query(
          `SELECT action_date, action_type, agency, amount, description
           FROM fomb_actions
           WHERE action_date >= $1
           ORDER BY action_date DESC
           LIMIT 20`,
          [cutoff.toISOString()],
        );
        if (historial.length > 0) {
          historialFomb = historial
            .map((h: Record<string, unknown>) =>
              [
                h.action_date ? `[${h.action_date}]` : null,
                h.action_type,
                h.agency,
                h.amount ? `$${h.amount}` : null,
                h.description,
              ]
                .filter(Boolean)
                .join(' | '),
            )
            .join('\n');
        }
      } catch (err) {
        this.logger.warn(`FOMB historial query failed: ${err}`);
      }
    }

    const chunksText = chunks
      .map((c) => `[${c.section_reference ?? c.chunk_type}] ${c.content}`)
      .join('\n\n');

    return `Eres un experto en PROMESA y la Junta de Supervisión Fiscal de Puerto Rico.

ACCIÓN FOMB RELEVANTE:
${fombActionData}

HISTORIAL DE ACCIONES FOMB EN ESTE SECTOR (últimos 24 meses):
${historialFomb}

FRAGMENTOS DEL DOSSIER SELECCIONADOS:
${chunksText || '[SIN FRAGMENTOS SELECCIONADOS]'}

Genera un análisis de riesgo de implementación para esta medida considerando:
1. Probabilidad de objeción FOMB basada en el historial
2. Elementos específicos de la medida que pueden conflictuar con el Plan Fiscal vigente
3. Recomendaciones para enmendar la medida y reducir el riesgo FOMB
4. Precedentes de negociación exitosa con la FOMB en casos similares

Si algún dato no está disponible en el contexto proporcionado, márcalo [SIN FUENTE EN DOSSIER].`;
  }

  private async getLegislatorContext(legislatorId: string): Promise<string | undefined> {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/legislators/${legislatorId}`,
        { timeout: 5000 },
      );
      const leg = response.data;
      return `Nombre: ${leg.full_name ?? ''}, Partido: ${leg.party ?? ''}, Cámara: ${leg.chamber ?? ''}`;
    } catch {
      return undefined;
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      return '[GEMINI_API_KEY no configurada — contenido no generado]';
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      },
      { timeout: 120000 },
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[Sin contenido generado]';
  }
}
