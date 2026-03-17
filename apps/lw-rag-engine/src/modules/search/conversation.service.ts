import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DossierConversation } from '../../entities/dossier-conversation.entity';
import { DossierMessage, MessageRole, MessageCitation } from '../../entities/dossier-message.entity';
import { SemanticSearchService } from './semantic-search.service';

const SYSTEM_PROMPT = `Eres un asistente legal especializado en legislación de Puerto Rico. Tu única fuente de verdad son los documentos del dossier proporcionados.

REGLA ABSOLUTA: Solo puedes afirmar hechos que estén explícitamente presentes en los fragmentos documentales a continuación. Si la respuesta no está en los documentos, di exactamente: "Esta información no está disponible en los documentos del dossier." No uses conocimiento externo bajo ninguna circunstancia.

Para cada afirmación que hagas, incluye una cita en el formato: [CITE:chunk_id:section_reference:page_number]

Responde en español.`;

function parseCitations(content: string): { cleanContent: string; citations: MessageCitation[] } {
  const citeRegex = /\[CITE:([^:]+):([^:]*):([^\]]*)\]/g;
  const citations: MessageCitation[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = citeRegex.exec(content)) !== null) {
    const chunk_id = match[1];
    if (!seen.has(chunk_id)) {
      seen.add(chunk_id);
      citations.push({
        chunk_id,
        document_name: '',
        section_reference: match[2] || undefined,
        page_number: match[3] ? parseInt(match[3], 10) : undefined,
      });
    }
  }

  // Remove citations from display content, keep readable text
  const cleanContent = content.replace(/\[CITE:[^\]]+\]/g, '').trim();
  return { cleanContent, citations };
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly geminiApiKey: string | undefined;

  constructor(
    @InjectRepository(DossierConversation)
    private readonly convRepo: Repository<DossierConversation>,
    @InjectRepository(DossierMessage)
    private readonly msgRepo: Repository<DossierMessage>,
    private readonly searchService: SemanticSearchService,
    private readonly configService: ConfigService,
  ) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
  }

  async createConversation(projectId: string, title?: string): Promise<DossierConversation> {
    const conv = this.convRepo.create({ project_id: projectId, title });
    return this.convRepo.save(conv);
  }

  async listConversations(projectId: string): Promise<DossierConversation[]> {
    return this.convRepo.find({
      where: { project_id: projectId },
      order: { updated_at: 'DESC' },
    });
  }

  async getMessages(conversationId: string): Promise<DossierMessage[]> {
    return this.msgRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
    });
  }

  async sendMessage(
    conversationId: string,
    userContent: string,
  ): Promise<DossierMessage> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found`);

    // Save user message
    const userMsg = await this.msgRepo.save(
      this.msgRepo.create({ conversation_id: conversationId, role: MessageRole.USER, content: userContent }),
    );

    // Get recent history (last 6 messages)
    const history = await this.msgRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' },
      take: 7, // user message + 6 history
    });
    history.reverse();
    const historyExcludingCurrent = history.filter((m) => m.id !== userMsg.id);

    // Semantic search for relevant chunks
    const relevantChunks = await this.searchService.search(userContent, conv.project_id, 8);

    // Build context
    const chunksContext = relevantChunks
      .map(
        (c) =>
          `[FRAGMENTO id="${c.id}" tipo="${c.chunk_type}" seccion="${c.section_reference ?? ''}" pagina="${c.page_number ?? ''}"]
${c.content}
[/FRAGMENTO]`,
      )
      .join('\n\n');

    const historyContext = historyExcludingCurrent
      .map((m) => `${m.role === MessageRole.USER ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n');

    const fullPrompt = `${SYSTEM_PROMPT}

FRAGMENTOS DEL DOSSIER:
${chunksContext || 'No se encontraron fragmentos relevantes.'}

HISTORIAL DE CONVERSACIÓN:
${historyContext || 'Inicio de conversación.'}

PREGUNTA DEL USUARIO:
${userContent}`;

    // Call Gemini
    let assistantContent = 'Esta información no está disponible en los documentos del dossier.';
    try {
      assistantContent = await this.callGemini(fullPrompt);
    } catch (err) {
      this.logger.error(`Gemini call failed: ${err}`);
    }

    const { cleanContent, citations } = parseCitations(assistantContent);

    // Update citation document names from search results
    const chunkMap = new Map(relevantChunks.map((c) => [c.id, c]));
    const enrichedCitations = citations.map((cite) => {
      const chunk = chunkMap.get(cite.chunk_id);
      return { ...cite, document_name: chunk ? `${cite.section_reference ?? 'Documento'}` : cite.document_name };
    });

    const assistantMsg = await this.msgRepo.save(
      this.msgRepo.create({
        conversation_id: conversationId,
        role: MessageRole.ASSISTANT,
        content: cleanContent,
        citations: enrichedCitations.length > 0 ? enrichedCitations : undefined,
      }),
    );

    // Update conversation timestamp
    await this.convRepo.update(conversationId, { updated_at: new Date() });

    return assistantMsg;
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiApiKey) {
      return 'GEMINI_API_KEY no configurada. Esta información no está disponible en los documentos del dossier.';
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      },
      { timeout: 60000 },
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No se pudo generar una respuesta.';
  }
}
