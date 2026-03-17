import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import { AI_SUMMARIES_CONSTANTS, SummaryType } from './ai-summaries.constants';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AiSummaryRow {
  id: string;
  bill_id: string;
  bill_version_id: string | null;
  summary_type: SummaryType;
  content: string;
  generated_by_model: string;
  language: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DiffSummaryRow {
  id: string;
  bill_id: string;
  version_from_id: string | null;
  version_to_id: string | null;
  content: string;
  added_elements: string[];
  removed_elements: string[];
  generated_by_model: string;
  created_by: string;
  created_at: Date;
}

export interface AudioBriefingRow {
  id: string;
  user_id: string;
  briefing_date: string;
  script_content: string;
  audio_url: string | null;
  duration_seconds: number | null;
  generation_status: 'pending' | 'generating' | 'completed' | 'error';
  created_at: Date;
  updated_at: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AiSummariesService {
  private readonly logger = new Logger(AiSummariesService.name);

  constructor(private readonly db: DatabaseService) {}

  // ── Summary generation ──────────────────────────────────────────────────────

  async generateSummary(
    billId: string,
    summaryType: SummaryType,
    userId: string,
  ): Promise<AiSummaryRow> {
    // Check cache: if summary exists and was created < 24h ago, return it
    const cached = await this.db.query(
      `SELECT * FROM ai_summaries
       WHERE bill_id = $1 AND summary_type = $2
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [billId, summaryType],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0] as AiSummaryRow;
    }

    // Fetch bill text
    const billText = await this.getBillText(billId);
    const billNumber = await this.getBillNumber(billId);

    // Build prompt and call Gemini
    const prompt = this.buildSummaryPrompt(summaryType, billText, billNumber);
    const content = await this.callGemini(prompt);

    // Save to DB
    const result = await this.db.query(
      `INSERT INTO ai_summaries
         (bill_id, summary_type, content, generated_by_model, language, created_by)
       VALUES ($1, $2, $3, $4, 'es', $5)
       RETURNING *`,
      [billId, summaryType, content, AI_SUMMARIES_CONSTANTS.GEMINI_MODEL, userId],
    );
    return result.rows[0] as AiSummaryRow;
  }

  async getSummaries(billId: string): Promise<AiSummaryRow[]> {
    const res = await this.db.query(
      `SELECT * FROM ai_summaries WHERE bill_id = $1 ORDER BY created_at DESC`,
      [billId],
    );
    return res.rows as AiSummaryRow[];
  }

  // ── Diff summaries ──────────────────────────────────────────────────────────

  async generateDiffSummary(
    billId: string,
    versionFromId: string,
    versionToId: string,
    userId: string,
  ): Promise<DiffSummaryRow> {
    // Check cache
    const cached = await this.db.query(
      `SELECT * FROM ai_diff_summaries
       WHERE bill_id = $1 AND version_from_id = $2 AND version_to_id = $3
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [billId, versionFromId, versionToId],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0] as DiffSummaryRow;
    }

    // Fetch both versions' text
    const billNumber = await this.getBillNumber(billId);
    const textBefore = await this.getVersionText(versionFromId);
    const textAfter = await this.getVersionText(versionToId);

    const prompt = this.buildDiffPrompt(textBefore, textAfter, billNumber);
    const content = await this.callGemini(prompt);

    // Parse added/removed from the content (heuristic extraction)
    const added = this.extractListFromSection(content, 'QUÉ SE AÑADIÓ');
    const removed = this.extractListFromSection(content, 'QUÉ SE ELIMINÓ');

    const result = await this.db.query(
      `INSERT INTO ai_diff_summaries
         (bill_id, version_from_id, version_to_id, content, added_elements, removed_elements, generated_by_model, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        billId,
        versionFromId,
        versionToId,
        content,
        JSON.stringify(added),
        JSON.stringify(removed),
        AI_SUMMARIES_CONSTANTS.GEMINI_MODEL,
        userId,
      ],
    );
    return result.rows[0] as DiffSummaryRow;
  }

  async getDiffSummaries(billId: string): Promise<DiffSummaryRow[]> {
    const res = await this.db.query(
      `SELECT * FROM ai_diff_summaries WHERE bill_id = $1 ORDER BY created_at DESC`,
      [billId],
    );
    return res.rows as DiffSummaryRow[];
  }

  // ── Audio briefing ──────────────────────────────────────────────────────────

  async getAudioBriefingToday(userId: string): Promise<AudioBriefingRow | null> {
    const res = await this.db.query(
      `SELECT * FROM audio_briefings
       WHERE user_id = $1 AND briefing_date = CURRENT_DATE
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return res.rows.length > 0 ? (res.rows[0] as AudioBriefingRow) : null;
  }

  async generateAudioBriefing(
    userId: string,
    briefingData: Record<string, unknown>,
  ): Promise<AudioBriefingRow> {
    const today = new Date().toISOString().split('T')[0];

    // Build script from briefing data
    const script = this.buildAudioScript(briefingData, today);

    // Insert with 'generating' status
    const insertRes = await this.db.query(
      `INSERT INTO audio_briefings
         (user_id, briefing_date, script_content, generation_status)
       VALUES ($1, $2, $3, 'generating')
       ON CONFLICT (user_id, briefing_date)
       DO UPDATE SET script_content = EXCLUDED.script_content,
                     generation_status = 'generating',
                     updated_at = NOW()
       RETURNING *`,
      [userId, today, script],
    );
    const row = insertRes.rows[0] as AudioBriefingRow;

    // Attempt TTS synthesis
    let audioUrl: string | null = null;
    try {
      audioUrl = await this.synthesizeSpeech(script);
    } catch (e) {
      this.logger.warn(`TTS synthesis failed for user ${userId}: ${(e as Error).message}`);
    }

    // Update with result
    const updateRes = await this.db.query(
      `UPDATE audio_briefings
       SET audio_url = $1,
           generation_status = 'completed',
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [audioUrl, row.id],
    );
    return updateRes.rows[0] as AudioBriefingRow;
  }

  async getBriefingDataForUser(userId: string): Promise<Record<string, unknown>> {
    // Try to use cached dashboard_briefings from fiscal-intelligence module
    const cached = await this.db.query(
      `SELECT content FROM dashboard_briefings
       WHERE user_id = $1 AND briefing_date = CURRENT_DATE
       ORDER BY generated_at DESC LIMIT 1`,
      [userId],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0].content as Record<string, unknown>;
    }

    // Fallback: build basic briefing data from DB
    const updates = await this.db.query(
      `SELECT numero, titulo, status FROM sutra_measures
       WHERE updated_at > NOW() - INTERVAL '24 hours'
       ORDER BY updated_at DESC LIMIT 10`,
      [],
    );
    return {
      date: new Date().toLocaleDateString('es-PR'),
      recent_updates: updates.rows,
    };
  }

  // ── Active users helper (for scheduler) ────────────────────────────────────

  async getActiveUserIds(): Promise<string[]> {
    // Try watchlist_items first
    const res = await this.db.query(
      `SELECT DISTINCT user_id FROM watchlist_items
       WHERE created_at > NOW() - INTERVAL '30 days'`,
      [],
    );
    if (res.rows.length > 0) {
      return res.rows.map((r: { user_id: string }) => r.user_id);
    }

    // Fallback: notifications table
    const notifRes = await this.db.query(
      `SELECT DISTINCT user_id FROM notifications
       WHERE created_at > NOW() - INTERVAL '30 days'`,
      [],
    );
    return notifRes.rows.map((r: { user_id: string }) => r.user_id);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getBillText(billId: string): Promise<string> {
    // Prefer bill_versions text_content if available
    const verRes = await this.db.query(
      `SELECT text_content, version_label FROM bill_versions
       WHERE measure_id = $1 AND is_current = true
       LIMIT 1`,
      [billId],
    );
    if (verRes.rows.length > 0 && verRes.rows[0].text_content) {
      return verRes.rows[0].text_content as string;
    }

    // Fallback: titulo + extracto from sutra_measures
    const billRes = await this.db.query(
      `SELECT titulo, extracto FROM sutra_measures WHERE id = $1`,
      [billId],
    );
    if (billRes.rows.length === 0) return '';
    const b = billRes.rows[0];
    return `${b.titulo || ''}\n\n${b.extracto || ''}`;
  }

  private async getBillNumber(billId: string): Promise<string> {
    const res = await this.db.query(
      `SELECT numero FROM sutra_measures WHERE id = $1`,
      [billId],
    );
    return res.rows.length > 0 ? (res.rows[0].numero as string) : billId;
  }

  private async getVersionText(versionId: string): Promise<string> {
    const res = await this.db.query(
      `SELECT text_content FROM bill_versions WHERE id = $1`,
      [versionId],
    );
    return res.rows.length > 0 ? ((res.rows[0].text_content as string) || '') : '';
  }

  private buildSummaryPrompt(
    summaryType: SummaryType,
    billText: string,
    billNumber: string,
  ): string {
    switch (summaryType) {
      case 'executive':
        return `Eres un analista legislativo experto en Puerto Rico. Lee el siguiente proyecto de ley y genera un resumen ejecutivo de exactamente 5 líneas.

REQUISITOS:
- Sin jerga legal. Lenguaje que entienda cualquier ejecutivo.
- Qué hace la medida, a quién afecta directamente, y qué está en juego económicamente.
- Si hay números o cifras en el texto, inclúyelos.
- NO incluir el número de medida ni el título en el resumen.

PROYECTO DE LEY ${billNumber}:
${billText}`;

      case 'technical_legal':
        return `Eres un abogado especializado en derecho legislativo de Puerto Rico. Analiza el siguiente proyecto de ley y genera un análisis técnico-legal de 3 a 4 párrafos.

ESTRUCTURA REQUERIDA:
1. Leyes vigentes de PR que serían modificadas o derogadas (con número de ley si se menciona).
2. Artículos o secciones con lenguaje ambiguo que podría generar litigios.
3. Aspectos constitucionales o de PROMESA que podrían ser cuestionados.
4. Impacto en el marco regulatorio existente.

Usa la misma terminología técnica del texto oficial. Si no puedes determinar algo con certeza, dilo explícitamente.

PROYECTO DE LEY ${billNumber}:
${billText}`;

      case 'tweet':
        return `Resume el siguiente proyecto de ley en 1 o 2 oraciones máximo para un comunicado en redes sociales. Lenguaje directo y neutral. Sin hashtags. Sin emojis. Máximo 280 caracteres en total.

PROYECTO DE LEY ${billNumber}:
${billText}`;
    }
  }

  private buildDiffPrompt(
    textBefore: string,
    textAfter: string,
    billNumber: string,
  ): string {
    return `Compara estas dos versiones de un proyecto de ley de Puerto Rico y explica en lenguaje sencillo qué cambió.

ESTRUCTURA REQUERIDA:
- QUÉ SE AÑADIÓ: Lista de cambios nuevos incorporados en la versión actual.
- QUÉ SE ELIMINÓ: Lista de disposiciones que estaban en la versión anterior y ya no están.
- IMPACTO DEL CAMBIO: En 2-3 oraciones, qué significa estratégicamente este cambio para los afectados.

Si los cambios son menores (editoriales, corrección de errores), indícalo claramente.

VERSIÓN ANTERIOR — ${billNumber}:
${textBefore}

VERSIÓN ACTUAL — ${billNumber}:
${textAfter}`;
  }

  private buildAudioScript(
    data: Record<string, unknown>,
    dateStr: string,
  ): string {
    const dateFmt = new Date(dateStr).toLocaleDateString('es-PR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const critical = (data.critical_items as unknown[]) || [];
    const updates = (data.recent_updates as unknown[]) || [];

    let script = `Buenos días. Aquí tu briefing legislativo de Puerto Rico para el ${dateFmt}. `;

    if (critical.length > 0) {
      script += `Comenzamos con los asuntos urgentes. `;
      for (const item of critical.slice(0, 3)) {
        script += `${JSON.stringify(item)}. `;
      }
    }

    if (updates.length > 0) {
      script += `En cuanto a novedades del portafolio, `;
      for (const u of updates.slice(0, 5)) {
        const upd = u as Record<string, unknown>;
        script += `la medida ${upd.numero || ''} muestra actividad reciente. `;
      }
    }

    script += `Eso es todo para hoy. Que tengas un buen día.`;
    return script;
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // ARQUITECTURA: TTS no configurado — guardamos solo el script
      return '[Resumen no disponible — GEMINI_API_KEY no configurado]';
    }

    const response = await axios.post(
      `${AI_SUMMARIES_CONSTANTS.GEMINI_API_URL}?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 30000 },
    );
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private async synthesizeSpeech(text: string): Promise<string | null> {
    // Priority 1: Google Cloud TTS
    if (process.env.GOOGLE_TTS_API_KEY) {
      const res = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
        {
          input: { text },
          voice: { languageCode: 'es-US', ssmlGender: 'NEUTRAL' },
          audioConfig: { audioEncoding: 'MP3' },
        },
        { timeout: 30000 },
      );
      const audioContent: string = res.data?.audioContent ?? '';
      return `data:audio/mp3;base64,${audioContent}`;
    }

    // Priority 2: ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      const res = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text, model_id: 'eleven_multilingual_v2' },
        {
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
          responseType: 'arraybuffer',
          timeout: 60000,
        },
      );
      const b64 = Buffer.from(res.data as ArrayBuffer).toString('base64');
      return `data:audio/mpeg;base64,${b64}`;
    }

    // ARQUITECTURA: TTS no configurado — guardamos solo el script, audio_url = null
    this.logger.warn(
      'No TTS provider configured. Set GOOGLE_TTS_API_KEY or ELEVENLABS_API_KEY to enable audio.',
    );
    return null;
  }

  private extractListFromSection(content: string, sectionTitle: string): string[] {
    const regex = new RegExp(`${sectionTitle}[:\\s]*([\\s\\S]*?)(?=QUÉ SE|IMPACTO|$)`, 'i');
    const match = content.match(regex);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line) => line.length > 10);
  }
}
