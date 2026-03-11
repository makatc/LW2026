import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import axios from 'axios';

/**
 * Task 2.3 — Position Prediction Service
 *
 * Uses Gemini to predict a legislator's position on a specific measure
 * based on their thematic footprint, historical positions, and the
 * measure's content.
 *
 * Predictions are stored in `legislator_measure_positions` with
 * position_type = 'sugerida_por_ia' and a confidence_score.
 */
@Injectable()
export class PositionPredictionService {
    private readonly logger = new Logger(PositionPredictionService.name);
    private readonly geminiApiKey = process.env.GEMINI_API_KEY;
    private readonly geminiModel = 'gemini-2.0-flash';
    private readonly geminiUrl: string;

    constructor(private readonly db: DatabaseService) {
        this.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
    }

    /**
     * Predict a legislator's position on a specific measure.
     *
     * Returns existing confirmed position if available,
     * existing AI prediction if recent enough,
     * or generates a new prediction via Gemini.
     */
    async predictPosition(legislatorId: string, measureId: string) {
        // Check for existing confirmed position first
        const confirmedRes = await this.db.query(
            `SELECT * FROM legislator_measure_positions
             WHERE legislator_id = $1 AND measure_id = $2
               AND position_type = 'confirmada' AND is_superseded = false`,
            [legislatorId, measureId],
        );

        if (confirmedRes.rows[0]) {
            return {
                type: 'confirmed',
                position: confirmedRes.rows[0].position,
                confidence_score: 1.0,
                source: 'interaction',
                message: 'Posición confirmada por interacción directa.',
                data: confirmedRes.rows[0],
            };
        }

        // Check for recent AI prediction (less than 7 days old)
        const aiRes = await this.db.query(
            `SELECT * FROM legislator_measure_positions
             WHERE legislator_id = $1 AND measure_id = $2
               AND position_type = 'sugerida_por_ia' AND is_superseded = false
               AND updated_at > NOW() - INTERVAL '7 days'`,
            [legislatorId, measureId],
        );

        if (aiRes.rows[0]) {
            return {
                type: 'ai_cached',
                position: aiRes.rows[0].position,
                confidence_score: aiRes.rows[0].confidence_score,
                source: 'ai_prediction',
                message: 'Predicción IA reciente (< 7 días).',
                data: aiRes.rows[0],
            };
        }

        // Generate new prediction
        if (!this.geminiApiKey) {
            return {
                type: 'unavailable',
                position: null,
                confidence_score: 0,
                message: 'GEMINI_API_KEY not configured. Cannot generate prediction.',
            };
        }

        return this.generatePrediction(legislatorId, measureId);
    }

    /**
     * Predict positions for ALL active legislators on a specific measure.
     */
    async predictForAllLegislators(measureId: string) {
        const res = await this.db.query(
            'SELECT id, full_name FROM legislators WHERE is_active = true ORDER BY full_name',
        );

        const results = [];
        let success = 0;
        let skipped = 0;

        for (const leg of res.rows) {
            try {
                const result = await this.predictPosition(leg.id, measureId);
                results.push({ legislator_id: leg.id, legislator_name: leg.full_name, ...result });

                if (result.type === 'confirmed' || result.type === 'ai_cached') {
                    skipped++;
                } else {
                    success++;
                    // Rate limit: 1.5s between Gemini calls
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (err: any) {
                this.logger.warn(`Prediction failed for ${leg.full_name}: ${err.message}`);
            }
        }

        return {
            measure_id: measureId,
            total_legislators: res.rows.length,
            new_predictions: success,
            cached_or_confirmed: skipped,
            results,
        };
    }

    // ─── Private: Prediction Logic ────────────────────────────────────────────

    private async generatePrediction(legislatorId: string, measureId: string) {
        // Get legislator info + intelligence profile
        const legRes = await this.db.query(
            `SELECT l.id, l.full_name, l.chamber, l.party, l.district,
                    lip.thematic_footprint, lip.topic_positions, lip.key_priorities
             FROM legislators l
             LEFT JOIN legislator_intelligence_profiles lip ON lip.legislator_id = l.id
             WHERE l.id = $1`,
            [legislatorId],
        );
        if (!legRes.rows[0]) throw new NotFoundException('Legislator not found');
        const legislator = legRes.rows[0];

        // Get measure info
        const measureRes = await this.db.query(
            `SELECT id, numero, titulo, status, camara, autores, coautores,
                    resumen
             FROM sutra_measures
             WHERE id = $1`,
            [measureId],
        );
        if (!measureRes.rows[0]) throw new NotFoundException('Measure not found');
        const measure = measureRes.rows[0];

        // Get bill text if available
        let billText = '';
        try {
            const textRes = await this.db.query(
                `SELECT text_content FROM bill_versions
                 WHERE measure_id = $1 AND is_current = true
                 LIMIT 1`,
                [measureId],
            );
            if (textRes.rows[0]?.text_content) {
                billText = textRes.rows[0].text_content.slice(0, 3000); // Limit for context window
            }
        } catch { /* bill_versions may not exist */ }

        // Get past positions for context
        const pastPositions = await this.db.query(
            `SELECT lmp.position, lmp.position_type, lmp.confidence_score,
                    sm.numero AS measure_number, sm.titulo AS measure_title
             FROM legislator_measure_positions lmp
             LEFT JOIN sutra_measures sm ON sm.id = lmp.measure_id
             WHERE lmp.legislator_id = $1 AND lmp.is_superseded = false
             ORDER BY lmp.updated_at DESC
             LIMIT 10`,
            [legislatorId],
        );

        // Build prompt
        const prompt = this.buildPredictionPrompt(legislator, measure, billText, pastPositions.rows);

        this.logger.log(`🔮 Predicting position: ${legislator.full_name} → ${measure.numero}`);

        const aiResponse = await this.callGemini(prompt);
        if (!aiResponse) {
            return {
                type: 'ai_error',
                position: null,
                confidence_score: 0,
                message: 'Gemini API call failed',
            };
        }

        const prediction = this.parsePredictionResponse(aiResponse);

        // Save prediction
        // First supersede any existing AI predictions for this combo
        await this.db.query(
            `UPDATE legislator_measure_positions
             SET is_superseded = true, updated_at = NOW()
             WHERE legislator_id = $1 AND measure_id = $2
               AND position_type = 'sugerida_por_ia'`,
            [legislatorId, measureId],
        );

        // Insert new prediction
        await this.db.query(
            `INSERT INTO legislator_measure_positions
             (legislator_id, measure_id, position, position_type, confidence_score)
             VALUES ($1, $2, $3, 'sugerida_por_ia', $4)`,
            [legislatorId, measureId, prediction.position, prediction.confidence],
        );

        return {
            type: 'ai_new',
            position: prediction.position,
            confidence_score: prediction.confidence,
            reasoning: prediction.reasoning,
            source: 'ai_prediction',
            message: `Predicción generada por IA con ${Math.round(prediction.confidence * 100)}% de confianza.`,
        };
    }

    private buildPredictionPrompt(
        legislator: any,
        measure: any,
        billText: string,
        pastPositions: any[],
    ): string {
        let context = `Eres un analista político experto en la Asamblea Legislativa de Puerto Rico.
Predice la posición más probable del siguiente legislador sobre la medida indicada.

LEGISLADOR:
- Nombre: ${legislator.full_name}
- Cámara: ${legislator.chamber === 'upper' ? 'Senado' : 'Cámara'}
- Partido: ${legislator.party}
- Distrito: ${legislator.district || 'Acumulación'}`;

        if (legislator.thematic_footprint) {
            context += `\n\nHUELLA TEMÁTICA:\n${legislator.thematic_footprint}`;
        }

        if (legislator.topic_positions) {
            context += `\n\nPOSICIONES TEMÁTICAS:\n${JSON.stringify(legislator.topic_positions, null, 2)}`;
        }

        if (legislator.key_priorities) {
            context += `\n\nPRIORIDADES CLAVE:\n${JSON.stringify(legislator.key_priorities)}`;
        }

        if (pastPositions.length > 0) {
            context += `\n\nPOSICIONES PREVIAS EN OTRAS MEDIDAS:`;
            for (const p of pastPositions) {
                context += `\n  - ${p.measure_number}: ${p.position} (${p.position_type}, confianza: ${p.confidence_score || '?'})`;
            }
        }

        context += `\n\nMEDIDA A ANALIZAR:
- Número: ${measure.numero}
- Título: ${measure.titulo || '(sin título)'}
- Status: ${measure.status || '?'}
- Cámara: ${measure.camara || '?'}
- Autores: ${measure.autores || '?'}
- Coautores: ${measure.coautores || '?'}`;

        if (measure.resumen) {
            context += `\n- Resumen: ${measure.resumen}`;
        }

        if (billText) {
            context += `\n\nTEXTO DEL PROYECTO (extracto):\n${billText.slice(0, 2000)}`;
        }

        context += `\n\nINSTRUCCIONES:
Responde SOLO con un JSON sin markdown code blocks:

{
  "position": "a_favor | en_contra | indeciso | no_se_pronuncio",
  "confidence": 0.0,
  "reasoning": "Explicación breve de 2-3 oraciones de por qué se predice esta posición."
}

REGLAS:
- confidence entre 0.0 y 1.0
- Si no hay suficiente información, pon "indeciso" con confidence baja
- Considera el partido, huella temática, posiciones previas, y contenido de la medida
- Si el legislador es autor o coautor de la medida, la posición es "a_favor" con alta confianza
- Responde SOLO con el JSON`;

        return context;
    }

    private async callGemini(prompt: string): Promise<string | null> {
        try {
            const response = await axios.post(
                `${this.geminiUrl}?key=${this.geminiApiKey}`,
                {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 512,
                    },
                },
                {
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json' },
                },
            );

            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (err: any) {
            this.logger.error(`Gemini prediction call failed: ${err.message}`);
            return null;
        }
    }

    private parsePredictionResponse(rawText: string): {
        position: string;
        confidence: number;
        reasoning: string;
    } {
        const defaults = {
            position: 'indeciso',
            confidence: 0.1,
            reasoning: 'No se pudo analizar — datos insuficientes.',
        };

        try {
            let json = rawText.trim();
            if (json.startsWith('```')) {
                json = json.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
            }

            const parsed = JSON.parse(json);
            const validPositions = ['a_favor', 'en_contra', 'indeciso', 'no_se_pronuncio'];

            return {
                position: validPositions.includes(parsed.position) ? parsed.position : 'indeciso',
                confidence: typeof parsed.confidence === 'number'
                    ? Math.max(0, Math.min(1, parsed.confidence))
                    : 0.3,
                reasoning: parsed.reasoning || defaults.reasoning,
            };
        } catch (err: any) {
            this.logger.warn(`Failed to parse prediction response: ${err.message}`);
            return defaults;
        }
    }
}
