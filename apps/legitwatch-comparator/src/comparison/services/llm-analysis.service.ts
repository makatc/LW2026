import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface StakeholderEntity {
  name: string;
  type: 'agencia' | 'corporacion' | 'grupo_demografico' | 'individuo' | 'otro';
  impactDirection: 'positivo' | 'restrictivo' | 'neutro' | 'mixto';
  impactDescription: string;
  timeframe: {
    shortTerm?: string;
    mediumTerm?: string;
    longTerm?: string;
  };
}

export interface StakeholderAnalysis {
  entities: StakeholderEntity[];
  summary: string;
  overallImpact: 'positivo' | 'restrictivo' | 'neutro' | 'mixto';
}

/**
 * LlmAnalysisService
 * Calls Google Gemini API (gemini-2.0-flash) via HTTP for AI-powered analysis.
 * Falls back to stub responses when GEMINI_API_KEY is not configured.
 */
@Injectable()
export class LlmAnalysisService {
  private readonly logger = new Logger(LlmAnalysisService.name);
  private readonly apiKey: string | undefined;
  private readonly model = 'gemini-2.0-flash';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!this.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not configured — LLM features will use fallback responses.',
      );
    }
  }

  /**
   * Generate an executive summary from detected diffs.
   */
  async generateExecutiveSummary(
    chunkDiffs: Array<{ label: string; diffHtml: string; changeType?: string }>,
    sourceTitle: string,
    targetTitle: string,
  ): Promise<string> {
    if (!this.apiKey) {
      return this.stubSummary(chunkDiffs, sourceTitle, targetTitle);
    }

    const diffText = chunkDiffs
      .map(
        (c) =>
          `[${c.label}] Tipo: ${c.changeType ?? 'texto'}\n${this.stripHtml(c.diffHtml)}`,
      )
      .join('\n\n')
      .substring(0, 8000);

    const prompt = `Eres un analista legislativo especializado. Analiza los cambios entre dos versiones de un documento legislativo y genera un resumen ejecutivo conciso en español.

Documento original: "${sourceTitle}"
Documento propuesto: "${targetTitle}"

Cambios detectados por sección:
${diffText}

Genera un resumen ejecutivo (máximo 300 palabras) que:
1. Destaque únicamente las modificaciones sustanciales (presupuestos, penalidades, obligaciones, exenciones, definiciones)
2. Ignore cambios de formato, ortografía o puntuación menor
3. Use lenguaje claro y directo, sin jerga técnica innecesaria
4. Indique el impacto general del conjunto de cambios

Responde SOLO con el texto del resumen, sin encabezados ni listas.`;

    return this.callGemini(prompt, this.stubSummary(chunkDiffs, sourceTitle, targetTitle));
  }

  /**
   * Identify affected stakeholders and assess impact direction.
   */
  async analyzeStakeholders(
    addedText: string,
    removedText: string,
    documentContext: string,
  ): Promise<StakeholderAnalysis> {
    if (!this.apiKey) {
      return this.stubStakeholderAnalysis();
    }

    const prompt = `Eres un experto en análisis de impacto legislativo para Puerto Rico. Analiza los cambios legislativos e identifica las partes interesadas afectadas.

Contexto del documento: ${documentContext}

Texto AÑADIDO (nuevo en la propuesta):
${addedText.substring(0, 3000)}

Texto ELIMINADO (removido de la ley vigente):
${removedText.substring(0, 3000)}

Identifica las entidades afectadas. Responde en formato JSON estricto con esta estructura exacta:
{
  "entities": [
    {
      "name": "nombre de la entidad",
      "type": "agencia|corporacion|grupo_demografico|individuo|otro",
      "impactDirection": "positivo|restrictivo|neutro|mixto",
      "impactDescription": "descripción concisa del impacto en español",
      "timeframe": {
        "shortTerm": "consecuencia inmediata (0-1 año)",
        "mediumTerm": "consecuencia a mediano plazo (1-5 años)",
        "longTerm": "consecuencia a largo plazo (5+ años)"
      }
    }
  ],
  "summary": "resumen general del impacto en español (2-3 oraciones)",
  "overallImpact": "positivo|restrictivo|neutro|mixto"
}

Responde SOLO con el JSON. No incluyas texto adicional antes o después.`;

    const responseText = await this.callGemini(prompt, '');

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as StakeholderAnalysis;
      }
    } catch (e) {
      this.logger.error('Failed to parse stakeholder JSON from Gemini response', e);
    }

    return this.stubStakeholderAnalysis();
  }

  private async callGemini(prompt: string, fallback: string): Promise<string> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        },
        {
          headers: { 'content-type': 'application/json' },
          timeout: 30000,
        },
      );

      return (response.data as any).candidates?.[0]?.content?.parts?.[0]?.text ?? fallback;
    } catch (error) {
      this.logger.error('Gemini API call failed', (error as any)?.message);
      return fallback;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stubSummary(
    chunkDiffs: Array<{ changeType?: string }>,
    sourceTitle: string,
    targetTitle: string,
  ): string {
    const total = chunkDiffs.length;
    const types = chunkDiffs.reduce(
      (acc, c) => {
        if (c.changeType) acc[c.changeType] = (acc[c.changeType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const typeStr = Object.entries(types)
      .map(([t, n]) => `${n} ${t.replace(/_/g, ' ')}`)
      .join(', ');

    return `Comparación entre "${sourceTitle}" y "${targetTitle}": se detectaron ${total} secciones con cambios${typeStr ? ` (${typeStr})` : ''}. Configure GEMINI_API_KEY en el archivo .env para obtener un resumen generado por IA.`;
  }

  private stubStakeholderAnalysis(): StakeholderAnalysis {
    return {
      entities: [],
      summary:
        'Configure GEMINI_API_KEY en el archivo .env para activar el análisis de partes interesadas con IA.',
      overallImpact: 'neutro',
    };
  }
}
