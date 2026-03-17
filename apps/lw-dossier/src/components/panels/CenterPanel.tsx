'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Plus, ChevronDown, AlertCircle, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDossier, DossierMessage, MessageCitation } from '@/context/DossierContext';
import { getConversations, createConversation, getMessages, sendMessage } from '@/lib/api';

function CitationChip({ citation, onClick }: { citation: MessageCitation; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs bg-[#4F7CFF]/20 hover:bg-[#4F7CFF]/30 text-[#4F7CFF] border border-[#4F7CFF]/30 rounded px-1.5 py-0.5 mx-0.5 transition-colors"
    >
      <BookOpen className="w-3 h-3" />
      {citation.section_reference ?? `Fragmento`}
      {citation.page_number ? ` p.${citation.page_number}` : ''}
    </button>
  );
}

function MessageBubble({ msg, selectionMode, selectedChunkIds, onToggleChunk }: {
  msg: DossierMessage;
  selectionMode: boolean;
  selectedChunkIds: string[];
  onToggleChunk: (id: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'bg-[#3B69EB]/30 border border-[#3B69EB]/50' : 'bg-[#ffffff] border border-[#e2e8f0]'} rounded-lg px-4 py-3`}>
        <div className="chat-markdown text-sm text-[#1e293b] leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-[#e2e8f0] pt-2">
            {msg.citations.map((cite) => (
              <div key={cite.chunk_id} className="flex items-center gap-1">
                <CitationChip citation={cite} onClick={() => {}} />
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedChunkIds.includes(cite.chunk_id)}
                    onChange={() => onToggleChunk(cite.chunk_id)}
                    className="w-3.5 h-3.5 accent-[#4F7CFF]"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[#94a3b8] mt-1">{new Date(msg.created_at).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg px-4 py-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 bg-[#4F7CFF] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CenterPanel() {
  const { activeProject, activeConversation, setActiveConversation, rightPanelOpen, setRightPanelOpen, selectionMode, setSelectionMode, selectedChunkIds, addChunkId, removeChunkId } = useDossier();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations', activeProject?.id],
    queryFn: () => getConversations(activeProject!.id),
    enabled: !!activeProject,
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', activeConversation?.id],
    queryFn: () => getMessages(activeConversation!.id),
    enabled: !!activeConversation,
  });

  const createConvMutation = useMutation({
    mutationFn: () => createConversation(activeProject!.id, `Conversación ${new Date().toLocaleTimeString('es-PR')}`),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations', activeProject?.id] });
      setActiveConversation(conv);
    },
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(activeConversation!.id, content),
    onMutate: () => setIsThinking(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', activeConversation?.id] });
      setIsThinking(false);
    },
    onError: () => setIsThinking(false),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || !activeConversation || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate(content);
  }, [input, activeConversation, sendMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const hasProcessedDocs = activeProject?.documents?.some((d) => d.processing_status === 'completed');

  if (!activeProject) return <div className="flex-1" />;

  return (
    <div className="flex-1 h-full flex flex-col min-w-0 bg-[#F5F6FA]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[#e2e8f0] flex items-center justify-between px-4 bg-[#F5F6FA]">
        <div className="flex items-center gap-2">
          {/* Conversation selector */}
          <div className="relative">
            <button
              onClick={() => setShowConvDropdown((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#1e293b] hover:text-[#3B69EB] bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 transition-colors shadow-sm"
            >
              <span className="truncate max-w-[160px]">
                {activeConversation?.title ?? 'Seleccionar conversación'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
            </button>
            {showConvDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[#ffffff] border border-[#e2e8f0] rounded-lg shadow-xl z-20 overflow-hidden">
                <button
                  onClick={() => { createConvMutation.mutate(); setShowConvDropdown(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#4F7CFF] hover:bg-[#f1f5f9] transition-colors"
                >
                  <Plus className="w-4 h-4" /> Nueva conversación
                </button>
                {conversations?.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { setActiveConversation(conv); setShowConvDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm font-medium truncate transition-colors ${activeConversation?.id === conv.id ? 'bg-[#4F7CFF]/10 text-[#3B69EB]' : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e293b]'}`}
                  >
                    {conv.title ?? 'Sin título'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!activeConversation && (
            <button
              onClick={() => createConvMutation.mutate()}
              className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:text-[#6B8FF8] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!hasProcessedDocs && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-500">
              <AlertCircle className="w-3.5 h-3.5" />
              Sin documentos procesados
            </div>
          )}
          {selectionMode && (
            <span className="text-xs bg-[#4F7CFF]/20 text-[#4F7CFF] border border-[#4F7CFF]/30 rounded px-2 py-1">
              {selectedChunkIds.length} fragmentos seleccionados
            </span>
          )}
          <button
            onClick={() => { setRightPanelOpen(!rightPanelOpen); if (!rightPanelOpen) setSelectionMode(true); else setSelectionMode(false); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${rightPanelOpen ? 'bg-[#3B69EB] border-[#3B69EB] text-white shadow-sm' : 'bg-white border-[#cbd5e1] text-[#475569] hover:text-[#1e293b] hover:border-[#94a3b8]'}`}
          >
            Motor de Advocacy {rightPanelOpen ? '→' : '←'}
          </button>
        </div>
      </div>

      {/* Selection mode bar */}
      {selectionMode && (
        <div className="bg-[#4F7CFF]/10 border-b border-[#4F7CFF]/20 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-[#4F7CFF]">Modo selección activo — Elige los fragmentos del dossier para incluir en el documento</span>
          <button onClick={() => setSelectionMode(false)} className="text-xs text-[#64748b] hover:text-[#1e293b]">Salir</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {!activeConversation && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              {hasProcessedDocs ? (
                <>
                  <div className="w-12 h-12 bg-[#3B69EB]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-[#4F7CFF]" />
                  </div>
                  <p className="text-[#475569] font-medium text-sm mb-3">Inicia una conversación para interrogar los documentos del dossier</p>
                  <button
                    onClick={() => createConvMutation.mutate()}
                    className="bg-[#3B69EB] hover:bg-[#4F7CFF] text-white text-sm rounded-lg px-4 py-2 transition-colors"
                  >
                    Nueva Conversación
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-[#64748b]" />
                  </div>
                  <p className="text-[#475569] font-medium text-sm">Sube documentos al dossier para comenzar a interrogarlos</p>
                </>
              )}
            </div>
          </div>
        )}

        {messages?.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            selectionMode={selectionMode}
            selectedChunkIds={selectedChunkIds}
            onToggleChunk={(id) => selectedChunkIds.includes(id) ? removeChunkId(id) : addChunkId(id)}
          />
        ))}

        {isThinking && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {activeConversation && (
        <div className="border-t border-[#e2e8f0] p-4">
          <div className="flex gap-2 items-end bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre los documentos del dossier..."
              disabled={sendMutation.isPending}
              rows={1}
              className="flex-1 bg-transparent text-sm text-[#1e293b] placeholder-[#94a3b8] resize-none focus:outline-none min-h-[24px] max-h-[160px]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="flex-shrink-0 bg-[#3B69EB] hover:bg-[#4F7CFF] disabled:opacity-40 text-white rounded p-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      )}
    </div>
  );
}
