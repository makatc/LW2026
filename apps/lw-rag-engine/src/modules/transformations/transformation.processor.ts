import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DossierTransformation, GenerationStatus, TransformationType, ClientStance } from '../../entities/dossier-transformation.entity';
import { DossierChunk } from '../../entities/dossier-chunk.entity';

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
    private readonly configService: ConfigService,
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

      // Get legislator context if available
      let legislatorContext: string | undefined;
      if (transformation.legislator_id) {
        legislatorContext = await this.getLegislatorContext(transformation.legislator_id);
      }

      const prompt = buildPrompt(
        transformation.transformation_type,
        chunks,
        transformation.client_stance,
        transformation.tone_profile ?? undefined,
        legislatorContext,
        transformation.custom_instructions ?? undefined,
      );

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
