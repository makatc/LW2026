'use client';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Scroll, Mail, Target, Mic, BarChart2, Settings, Check, Copy,
  RefreshCw, Loader2, ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import { useDossier, DossierTransformation } from '@/context/DossierContext';
import { createTransformation, getTransformation, getProjectTransformations, updateTransformation, searchLegislators } from '@/lib/api';

type TransformationType = 'memorial_explicativo' | 'carta_legislador' | 'talking_points' | 'testimonio' | 'resumen_ejecutivo' | 'personalizado';
type ClientStance = 'apoyo' | 'oposicion' | 'apoyo_con_enmiendas' | 'neutral';
type ToneProfile = 'formal_juridico' | 'ejecutivo_corporativo' | 'tecnico_regulatorio';

const DOC_TYPES: Array<{ value: TransformationType; label: string; icon: string }> = [
  { value: 'memorial_explicativo', label: 'Memorial Explicativo', icon: '📜' },
  { value: 'carta_legislador', label: 'Carta a Legislador', icon: '✉️' },
  { value: 'talking_points', label: 'Talking Points', icon: '🎯' },
  { value: 'testimonio', label: 'Testimonio', icon: '🎤' },
  { value: 'resumen_ejecutivo', label: 'Resumen Ejecutivo', icon: '📊' },
  { value: 'personalizado', label: 'Personalizado', icon: '⚙️' },
];

const STANCE_OPTIONS: Array<{ value: ClientStance; label: string; icon: string; color: string }> = [
  { value: 'apoyo', label: 'Apoyo', icon: '✅', color: 'border-green-500/50 bg-green-500/10 text-green-400' },
  { value: 'oposicion', label: 'Oposición', icon: '❌', color: 'border-red-500/50 bg-red-500/10 text-red-400' },
  { value: 'apoyo_con_enmiendas', label: 'Apoyo c/Enmiendas', icon: '🔧', color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
  { value: 'neutral', label: 'Neutral', icon: '⚖️', color: 'border-[#e2e8f0] bg-[#e2e8f0] text-[#64748b]' },
];

const TONE_OPTIONS: Array<{ value: ToneProfile; label: string }> = [
  { value: 'formal_juridico', label: 'Formal Jurídico' },
  { value: 'ejecutivo_corporativo', label: 'Ejecutivo Corporativo' },
  { value: 'tecnico_regulatorio', label: 'Técnico Regulatorio' },
];

function LegislatorSearch({ onSelect }: { onSelect: (leg: { id: string; full_name: string; party?: string; chamber: string } | null) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; full_name: string; party?: string; chamber: string } | null>(null);
  const [open, setOpen] = useState(false);

  const { data: results } = useQuery({
    queryKey: ['legislators-search', search],
    queryFn: () => searchLegislators(search),
    enabled: search.length >= 2,
    staleTime: 5000,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-[#f1f5f9] border border-[#e2e8f0] rounded p-2">
        <div>
          <p className="text-xs font-medium text-[#1e293b]">{selected.full_name}</p>
          <p className="text-xs text-[#64748b]">{selected.party ?? ''} · {selected.chamber === 'upper' ? 'Senado' : 'Cámara'}</p>
        </div>
        <button onClick={() => { setSelected(null); onSelect(null); }} className="text-[#64748b] hover:text-red-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[#F5F6FA] border border-[#e2e8f0] rounded px-2 py-1.5">
        <Search className="w-3.5 h-3.5 text-[#64748b]" />
        <input
          className="flex-1 bg-transparent text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none"
          placeholder="Buscar legislador..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && results && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#ffffff] border border-[#e2e8f0] rounded shadow-xl z-20">
          {results.map((leg) => (
            <button
              key={leg.id}
              className="w-full text-left px-3 py-2 hover:bg-[#f1f5f9] transition-colors"
              onClick={() => { setSelected(leg); onSelect(leg); setOpen(false); setSearch(''); }}
            >
              <p className="text-xs text-[#1e293b]">{leg.full_name}</p>
              <p className="text-xs text-[#64748b]">{leg.party ?? ''} · {leg.chamber === 'upper' ? 'Senado' : 'Cámara'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneratedEditor({ transformation, onRegenerate }: { transformation: DossierTransformation; onRegenerate: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState(transformation.generated_content ?? '');

  // Poll while generating
  const { data: polled } = useQuery({
    queryKey: ['transformation', transformation.id],
    queryFn: () => getTransformation(transformation.id),
    refetchInterval: transformation.generation_status === 'generating' || transformation.generation_status === 'pending' ? 2000 : false,
  });

  const currentContent = polled?.generated_content ?? content;
  const status = polled?.generation_status ?? transformation.generation_status;

  const saveMutation = useMutation({
    mutationFn: () => updateTransformation(transformation.id, content),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'pending' || status === 'generating') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#4F7CFF] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#64748b]">Generando documento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#e2e8f0]">
        <span className="text-xs font-medium text-[#1e293b] truncate">{transformation.title}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1e293b] transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onRegenerate} className="text-[#64748b] hover:text-[#1e293b] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <textarea
        className="flex-1 bg-[#F5F6FA] text-xs text-[#1e293b] p-4 resize-none focus:outline-none font-mono leading-relaxed"
        value={currentContent}
        onChange={(e) => { setContent(e.target.value); }}
        onBlur={() => { if (content !== transformation.generated_content) saveMutation.mutate(); }}
        placeholder={status === 'error' ? 'Error al generar el documento.' : ''}
      />
    </div>
  );
}

export default function RightPanel() {
  const { activeProject, setRightPanelOpen, selectedChunkIds, removeChunkId, clearChunks, activeTransformation, setActiveTransformation, setSelectionMode } = useDossier();
  const qc = useQueryClient();

  const [docType, setDocType] = useState<TransformationType>('memorial_explicativo');
  const [title, setTitle] = useState('');
  const [stance, setStance] = useState<ClientStance>('apoyo');
  const [tone, setTone] = useState<ToneProfile>('formal_juridico');
  const [legislatorId, setLegislatorId] = useState<string | undefined>();
  const [customInstructions, setCustomInstructions] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: history } = useQuery({
    queryKey: ['transformations', activeProject?.id],
    queryFn: () => getProjectTransformations(activeProject!.id),
    enabled: !!activeProject,
  });

  const createMutation = useMutation({
    mutationFn: () => createTransformation({
      project_id: activeProject!.id,
      transformation_type: docType,
      title: title || `${DOC_TYPES.find((t) => t.value === docType)?.label} — ${new Date().toLocaleDateString('es-PR')}`,
      legislator_id: legislatorId,
      client_stance: stance,
      tone_profile: tone,
      selected_chunk_ids: selectedChunkIds,
      custom_instructions: customInstructions || undefined,
    }),
    onSuccess: (t) => {
      setActiveTransformation(t);
      qc.invalidateQueries({ queryKey: ['transformations', activeProject?.id] });
    },
  });

  if (!activeProject) return null;

  return (
    <div className="panel-right h-full bg-white border-l border-[#e2e8f0] flex flex-col overflow-hidden shadow-md">
      {/* Header */}
      <div className="h-12 border-b border-[#e2e8f0] flex items-center justify-between px-3">
        <span className="text-sm font-bold text-[#1e293b] tracking-tight">Motor de Advocacy</span>
        <button onClick={() => { setRightPanelOpen(false); setSelectionMode(false); }} className="text-[#64748b] hover:text-[#1e293b]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeTransformation ? (
        <GeneratedEditor
          transformation={activeTransformation}
          onRegenerate={() => setActiveTransformation(null)}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Doc type */}
          <div>
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wide block mb-2">Tipo de documento</label>
            <div className="grid grid-cols-2 gap-1.5">
              {DOC_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setDocType(t.value)}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded border text-xs font-medium transition-colors text-left ${docType === t.value ? 'border-[#4F7CFF] bg-[#4F7CFF]/10 text-[#3B69EB] shadow-sm' : 'border-[#cbd5e1] bg-white text-[#475569] hover:border-[#4F7CFF]/50 hover:text-[#1e293b] hover:bg-[#f8fafc]'}`}
                >
                  <span>{t.icon}</span>
                  <span className="leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wide block mb-1">Título (opcional)</label>
            <input
              className="w-full bg-[#F5F6FA] border border-[#e2e8f0] rounded px-2 py-1.5 text-xs text-[#1e293b] focus:outline-none focus:border-[#4F7CFF]"
              placeholder="Se generará automáticamente si está vacío"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Legislator */}
          <div>
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wide block mb-1">Legislador objetivo (opcional)</label>
            <LegislatorSearch onSelect={(leg) => setLegislatorId(leg?.id)} />
          </div>

          {/* Stance */}
          <div>
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wide block mb-2">Postura del cliente</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STANCE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStance(s.value)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-semibold transition-colors ${stance === s.value ? s.color + ' shadow-sm' : 'border-[#cbd5e1] bg-white text-[#475569] hover:border-[#94a3b8] hover:bg-[#f8fafc]'}`}
                >
                  <span>{s.icon}</span> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wide block mb-2">Perfil de tono</label>
            <div className="flex flex-col gap-1">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`text-left px-3 py-1.5 rounded border text-xs font-medium transition-colors ${tone === t.value ? 'border-[#4F7CFF] bg-[#4F7CFF]/10 text-[#3B69EB] shadow-sm' : 'border-[#cbd5e1] bg-white text-[#475569] hover:border-[#4F7CFF]/50 hover:text-[#1e293b] hover:bg-[#f8fafc]'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected chunks */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wide">Contexto seleccionado ({selectedChunkIds.length})</label>
              {selectedChunkIds.length > 0 && (
                <button onClick={clearChunks} className="text-xs text-red-400 hover:text-red-300">Limpiar</button>
              )}
            </div>
            {selectedChunkIds.length === 0 ? (
              <p className="text-xs text-[#94a3b8] bg-[#F5F6FA] border border-dashed border-[#e2e8f0] rounded p-2 text-center">
                Selecciona fragmentos del chat para usarlos como contexto
              </p>
            ) : (
              <div className="space-y-1">
                {selectedChunkIds.map((id) => (
                  <div key={id} className="flex items-center justify-between bg-[#F5F6FA] border border-[#e2e8f0] rounded px-2 py-1">
                    <span className="text-xs text-[#64748b] font-mono truncate">{id.slice(0, 8)}...</span>
                    <button onClick={() => removeChunkId(id)} className="text-[#64748b] hover:text-red-400 ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom instructions */}
          <div>
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wide block mb-1">Instrucciones adicionales</label>
            <textarea
              className="w-full bg-[#F5F6FA] border border-[#e2e8f0] rounded px-2 py-1.5 text-xs text-[#1e293b] focus:outline-none focus:border-[#4F7CFF] resize-none"
              rows={3}
              placeholder="Instrucciones específicas para esta generación..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || selectedChunkIds.length === 0}
            className="w-full bg-[#3B69EB] hover:bg-[#4F7CFF] disabled:opacity-40 text-white rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {createMutation.isPending ? 'Generando...' : 'Generar Documento'}
          </button>

          {selectedChunkIds.length === 0 && (
            <p className="text-xs text-[#94a3b8] text-center -mt-2">
              Selecciona al menos un fragmento del chat para continuar
            </p>
          )}
        </div>
      )}

      {/* History */}
      <div className="border-t border-[#e2e8f0]">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-[#334155] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition-colors uppercase tracking-wide"
        >
          <span>Transformaciones recientes ({history?.length ?? 0})</span>
          {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {historyOpen && history && history.length > 0 && (
          <div className="max-h-48 overflow-y-auto border-t border-[#e2e8f0]">
            {history.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTransformation(t)}
                className="w-full text-left px-3 py-2 hover:bg-[#f1f5f9] border-b border-[#e2e8f0]/50 transition-colors"
              >
                <p className="text-xs font-semibold text-[#1e293b] truncate">{t.title}</p>
                <p className="text-xs text-[#475569] font-medium">{t.transformation_type} · {new Date(t.created_at).toLocaleDateString('es-PR')}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
