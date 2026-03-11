import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import axios from 'axios';

/**
 * Task 2.2 — Legislator Profile Generator Service
 *
 * Uses Google Gemini 2.0 Flash to analyze a legislator's historical data
 * and generate an intelligence profile containing:
 * - thematic_footprint: narrative summary of legislative focus areas
 * - topic_positions: structured positions by topic area
 * - key_priorities: list of top priorities
 * - voting_consistency: consistency score and description
 *
 * Follows the same Gemini REST API pattern as bill-text.scraper.ts
 */
@Injectable()
export class LegislatorProfileGeneratorService {
    private readonly logger = new Logger(LegislatorProfileGeneratorService.name);
    private readonly geminiApiKey = process.env.GEMINI_API_KEY;
    private readonly geminiModel = 'gemini-2.0-flash';
    private readonly geminiUrl: string;

    constructor(private readonly db: DatabaseService) {
        this.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
    }

    /**
     * Generate an AI profile for a single legislator.
     * Requires historical data to have been ingested first (Task 2.1).
     */
    async generateProfile(legislatorId: string) {
        if (!this.geminiApiKey) {
            return {
                error: 'GEMINI_API_KEY not configured',
                message: 'Set GEMINI_API_KEY env var to enable AI profile generation',
            };
        }

        // Get legislator info
        const legRes = await this.db.query(
            'SELECT id, full_name, chamber, party, district FROM legislators WHERE id = $1',
            [legislatorId],
        );
        if (!legRes.rows[0]) throw new NotFoundException('Legislator not found');
        const legislator = legRes.rows[0];

        // Get historical data
        const histRes = await this.db.query(
            'SELECT * FROM legislator_historical_data WHERE legislator_id = $1',
            [legislatorId],
        );
        const historicalData = histRes.rows[0];

        if (!historicalData) {
            return {
                error: 'no_historical_data',
                message: `No historical data found for ${legislator.full_name}. Run ingestion first (POST /api/intelligence/legislators/${legislatorId}/ingest).`,
            };
        }

        this.logger.log(`🧠 Generating AI profile for ${legislator.full_name}...`);

        // Build the context for Gemini
        const contextData = this.buildContextForGemini(legislator, historicalData);

        // Call Gemini
        const prompt = this.buildProfilePrompt(legislator, contextData);
        const aiResponse = await this.callGemini(prompt);

        if (!aiResponse) {
            return { error: 'gemini_failed', message: 'Gemini API call failed' };
        }

        // Parse the JSON response from Gemini
        const profile = this.parseProfileResponse(aiResponse);

        // Upsert into legislator_intelligence_profiles
        await this.db.query(
            `INSERT INTO legislator_intelligence_profiles
             (legislator_id, thematic_footprint, topic_positions, key_priorities,
              voting_consistency, raw_profile_json, last_generated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (legislator_id)
             DO UPDATE SET
                 thematic_footprint = $2,
                 topic_positions = $3,
                 key_priorities = $4,
                 voting_consistency = $5,
                 raw_profile_json = $6,
                 last_generated_at = NOW(),
                 updated_at = NOW()`,
            [
                legislatorId,
                profile.thematic_footprint,
                JSON.stringify(profile.topic_positions),
                JSON.stringify(profile.key_priorities),
                JSON.stringify(profile.voting_consistency),
                JSON.stringify({ raw_response: aiResponse, parsed: profile }),
            ],
        );

        this.logger.log(`✅ Profile generated for ${legislator.full_name}`);

        return {
            legislator_id: legislatorId,
            legislator_name: legislator.full_name,
            profile,
        };
    }

    /**
     * Batch generate profiles for all legislators that have historical data.
     */
    async generateAllProfiles() {
        const res = await this.db.query(
            `SELECT lhd.legislator_id
             FROM legislator_historical_data lhd
             JOIN legislators l ON l.id = lhd.legislator_id
             WHERE l.is_active = true
             ORDER BY l.full_name`,
        );

        const results = [];
        let success = 0;
        let failed = 0;

        for (const row of res.rows) {
            try {
                const result = await this.generateProfile(row.legislator_id);
                if (result.error) {
                    failed++;
                } else {
                    success++;
                }
                results.push(result);

                // Rate limiting: wait 2 seconds between API calls
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err: any) {
                this.logger.warn(`Profile generation failed for ${row.legislator_id}: ${err.message}`);
                failed++;
            }
        }

        return { total: res.rows.length, success, failed, results };
    }

    // ─── Private: Gemini Integration ──────────────────────────────────────────

    private buildContextForGemini(legislator: any, historicalData: any): string {
        const sections: string[] = [];

        sections.push(`LEGISLADOR: ${legislator.full_name}`);
        sections.push(`CÁMARA: ${legislator.chamber === 'upper' ? 'Senado' : 'Cámara de Representantes'}`);
        sections.push(`PARTIDO: ${legislator.party}`);
        sections.push(`DISTRITO: ${legislator.district || 'Acumulación'}`);

        // Authored measures
        const authored = historicalData.authored_measures || [];
        if (authored.length > 0) {
            sections.push(`\nMEDIDAS DE AUTORÍA (${authored.length} total):`);
            for (const m of authored.slice(0, 30)) {
                sections.push(`  - ${m.numero}: ${m.titulo || '(sin título)'} | Status: ${m.status || '?'}`);
            }
        }

        // Coauthored measures
        const coauthored = historicalData.coauthored_measures || [];
        if (coauthored.length > 0) {
            sections.push(`\nMEDIDAS CO-AUTORÍA (${coauthored.length} total):`);
            for (const m of coauthored.slice(0, 20)) {
                sections.push(`  - ${m.numero}: ${m.titulo || '(sin título)'}`);
            }
        }

        // Voting record
        const votes = historicalData.voting_record || [];
        if (votes.length > 0) {
            sections.push(`\nREGISTRO DE VOTOS (${votes.length} total):`);
            for (const v of votes.slice(0, 30)) {
                sections.push(`  - ${v.measure_number}: ${v.vote_type} | ${v.measure_title?.slice(0, 60) || '?'}`);
            }
        }

        // Interaction positions
        const rawData = historicalData.raw_data || {};
        const interactionPositions = rawData.interaction_positions || [];
        if (interactionPositions.length > 0) {
            sections.push(`\nPOSICIONES EXPRESADAS EN INTERACCIONES (${interactionPositions.length}):`);
            for (const ip of interactionPositions.slice(0, 20)) {
                sections.push(`  - ${ip.measure_number || ip.measure_reference || '?'}: ${ip.position_expressed} (${ip.contact_type}, ${ip.interaction_date})`);
            }
        }

        return sections.join('\n');
    }

    private buildProfilePrompt(legislator: any, contextData: string): string {
        return `Eres un analista político experto en la Asamblea Legislativa de Puerto Rico. 
Analiza los datos legislativos del siguiente legislador y genera un perfil de inteligencia.

${contextData}

INSTRUCCIONES:
Genera un JSON con la siguiente estructura EXACTA. No incluyas markdown code blocks, solo el JSON puro:

{
  "thematic_footprint": "Párrafo narrativo de 3-5 oraciones describiendo las áreas temáticas principales del legislador, su enfoque legislativo, y patrón de acción política.",
  "topic_positions": {
    "fiscal": {
      "tendency": "pro_incentivos | pro_austeridad | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    },
    "labor": {
      "tendency": "pro_trabajador | pro_empleador | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    },
    "health": {
      "tendency": "pro_expansion | pro_privatizacion | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    },
    "energy": {
      "tendency": "pro_renovables | pro_status_quo | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    },
    "environmental": {
      "tendency": "pro_regulacion | pro_desarrollo | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    },
    "education": {
      "tendency": "pro_reforma | pro_status_quo | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    },
    "public_safety": {
      "tendency": "pro_endurecimiento | pro_prevencion | mixto | sin_datos",
      "confidence": 0.0,
      "summary": "breve explicación"
    }
  },
  "key_priorities": ["prioridad 1", "prioridad 2", "prioridad 3", "prioridad 4", "prioridad 5"],
  "voting_consistency": {
    "score": 0.0,
    "description": "Descripción de qué tan consistente es el legislador con su partido y posiciones declaradas."
  }
}

REGLAS:
- confidence debe ser entre 0.0 y 1.0 (0 = sin datos, 1 = muy confiado)
- Si no hay datos suficientes para un topic, pon confidence en 0.0 y tendency en "sin_datos"
- key_priorities debe tener exactamente 5 elementos
- voting_consistency.score debe ser entre 0.0 y 1.0
- Responde SOLO con el JSON, sin explicaciones adicionales
- Basa tu análisis SOLO en los datos proporcionados, no inventes información`;
    }

    /**
     * Call Gemini REST API following the same pattern as bill-text.scraper.ts
     */
    private async callGemini(prompt: string): Promise<string | null> {
        try {
            const response = await axios.post(
                `${this.geminiUrl}?key=${this.geminiApiKey}`,
                {
                    contents: [{
                        parts: [{ text: prompt }],
                    }],
                    generationConfig: {
                        temperature: 0.3, // Low temperature for more consistent JSON output
                        maxOutputTokens: 2048,
                    },
                },
                {
                    timeout: 60000,
                    headers: { 'Content-Type': 'application/json' },
                },
            );

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return text;
        } catch (err: any) {
            this.logger.error(`Gemini API call failed: ${err.message}`);
            return null;
        }
    }

    /**
     * Parse Gemini response into structured profile data.
     * Handles cases where Gemini wraps JSON in markdown code blocks.
     */
    private parseProfileResponse(rawText: string): {
        thematic_footprint: string;
        topic_positions: Record<string, any>;
        key_priorities: string[];
        voting_consistency: { score: number; description: string };
    } {
        const defaults = {
            thematic_footprint: 'Perfil no disponible — datos insuficientes.',
            topic_positions: {},
            key_priorities: [],
            voting_consistency: { score: 0, description: 'Sin datos suficientes.' },
        };

        try {
            // Strip markdown code blocks if present
            let json = rawText.trim();
            if (json.startsWith('```')) {
                json = json.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
            }

            const parsed = JSON.parse(json);
            return {
                thematic_footprint: parsed.thematic_footprint || defaults.thematic_footprint,
                topic_positions: parsed.topic_positions || defaults.topic_positions,
                key_priorities: Array.isArray(parsed.key_priorities) ? parsed.key_priorities : defaults.key_priorities,
                voting_consistency: parsed.voting_consistency || defaults.voting_consistency,
            };
        } catch (err: any) {
            this.logger.warn(`Failed to parse Gemini profile response: ${err.message}`);
            return {
                ...defaults,
                thematic_footprint: rawText.slice(0, 500), // Use raw text as fallback narrative
            };
        }
    }
}
