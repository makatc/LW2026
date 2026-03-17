'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { generateSummary, getSummaries, getAudioBriefingToday } from '@/lib/advanced-intelligence-api';
import { fetchBillsEnhanced } from '@/lib/api';

type SummaryType = 'executive' | 'technical_legal' | 'tweet';

const SUMMARY_TYPES: { type: SummaryType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    type: 'executive',
    label: 'Ejecutivo',
    description: 'Resumen en lenguaje claro para tomadores de decisiones',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
  {
    type: 'technical_legal',
    label: 'Técnico-Legal',
    description: 'Análisis jurídico detallado con referencias normativas',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97Z" />
      </svg>
    ),
  },
  {
    type: 'tweet',
    label: 'Tweet/Post',
    description: 'Versión corta para redes sociales (max 280 caracteres)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
];

function AudioBriefingCard({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAudioBriefingToday(token)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-violet-200 rounded" />
            <div className="h-3 w-60 bg-violet-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-violet-900">Briefing de Audio — Hoy</h3>
          <p className="text-xs text-violet-600">Resumen legislativo generado por IA</p>
        </div>
      </div>
      {data.audio_url ? (
        <audio controls className="w-full h-8" src={data.audio_url}>
          Tu navegador no soporta el elemento de audio.
        </audio>
      ) : data.script ? (
        <p className="text-xs text-violet-800 leading-relaxed bg-white/60 rounded-lg p-3 border border-violet-100">
          {data.script}
        </p>
      ) : (
        <p className="text-xs text-violet-500 italic">Briefing de hoy aún no generado.</p>
      )}
    </div>
  );
}

interface Bill {
  id: string;
  bill_number?: string;
  measure_number?: string;
  title?: string;
  short_title?: string;
}

export default function AiSummariesTab() {
  const { user } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [billSearch, setBillSearch] = useState('');
  const [billResults, setBillResults] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [generating, setGenerating] = useState<SummaryType | null>(null);
  const [summaries, setSummaries] = useState<Record<SummaryType, any>>({} as any);
  const [existingSummaries, setExistingSummaries] = useState<any[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search bills
  useEffect(() => {
    if (!billSearch || billSearch.length < 2) {
      setBillResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetchBillsEnhanced({ search: billSearch, limit: 10 })
        .then((res: any) => setBillResults(res?.data || res || []))
        .catch(() => setBillResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [billSearch]);

  // Load existing summaries when bill is selected
  useEffect(() => {
    if (!selectedBill || !token) return;
    getSummaries(selectedBill.id, token)
      .then(setExistingSummaries)
      .catch(() => setExistingSummaries([]));
  }, [selectedBill, token]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectBill(bill: Bill) {
    setSelectedBill(bill);
    setBillSearch(bill.bill_number || bill.measure_number || '');
    setShowDropdown(false);
    setSummaries({} as any);
  }

  async function handleGenerate(type: SummaryType) {
    if (!selectedBill || !token) return;
    setGenerating(type);
    try {
      const result = await generateSummary(selectedBill.id, type, token);
      setSummaries((prev) => ({ ...prev, [type]: result }));
    } catch (e: any) {
      setSummaries((prev) => ({ ...prev, [type]: { error: e.message || 'Error al generar' } }));
    } finally {
      setGenerating(null);
    }
  }

  function isOlderThan24h(dateStr: string) {
    const d = new Date(dateStr);
    return Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
  }

  const billLabel = (b: Bill) =>
    [b.bill_number || b.measure_number, b.short_title || b.title].filter(Boolean).join(' — ');

  return (
    <div className="space-y-6">
      {/* Audio Briefing */}
      {token && <AudioBriefingCard token={token} />}

      {/* Bill selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Selecciona una medida
        </label>
        <div className="relative" ref={dropdownRef}>
          <input
            type="text"
            value={billSearch}
            onChange={(e) => {
              setBillSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) setSelectedBill(null);
            }}
            onFocus={() => billSearch.length >= 2 && setShowDropdown(true)}
            placeholder="Buscar por número o título (ej. PS1420)..."
            className="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {showDropdown && billResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {billResults.map((bill) => (
                <button
                  key={bill.id}
                  onClick={() => selectBill(bill)}
                  className="w-full text-left px-4 py-2.5 hover:bg-violet-50 text-sm border-b border-slate-100 last:border-0"
                >
                  <span className="font-semibold text-violet-700 mr-2">
                    {bill.bill_number || bill.measure_number}
                  </span>
                  <span className="text-slate-600 text-xs line-clamp-1">{bill.short_title || bill.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedBill && (
          <p className="text-xs text-slate-500 mt-1">
            Medida seleccionada: <span className="font-medium text-slate-700">{billLabel(selectedBill)}</span>
          </p>
        )}
      </div>

      {/* Summary type buttons */}
      {selectedBill && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-3">Generar resumen</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SUMMARY_TYPES.map(({ type, label, description, icon }) => {
              const isGenerating = generating === type;
              const existing = existingSummaries.find((s: any) => s.summary_type === type);
              const cached = summaries[type];
              const hasResult = cached || existing;

              return (
                <button
                  key={type}
                  onClick={() => handleGenerate(type)}
                  disabled={!!generating}
                  className={`relative flex flex-col items-start gap-2 p-4 border-2 rounded-xl text-left transition-all ${
                    hasResult
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                  } disabled:opacity-60`}
                >
                  <div className={`${hasResult ? 'text-violet-600' : 'text-slate-500'}`}>{icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                  </div>
                  {isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-medium text-violet-700">
                        <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        Generando...
                      </div>
                    </div>
                  )}
                  {hasResult && !isGenerating && (
                    <span className="absolute top-2 right-2 text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">
                      Listo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary results */}
      {SUMMARY_TYPES.map(({ type, label }) => {
        const result = summaries[type];
        if (!result) return null;

        const needsRegenerate = result.generated_at && isOlderThan24h(result.generated_at);

        return (
          <div key={type} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
                {result.generated_at && (
                  <span className="text-xs text-slate-400">
                    {new Date(result.generated_at).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {needsRegenerate && (
                  <button
                    onClick={() => handleGenerate(type)}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium hover:bg-amber-200"
                  >
                    Regenerar
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(result.content || result.text || '')}
                  className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded font-medium hover:bg-slate-200"
                >
                  Copiar
                </button>
              </div>
            </div>
            <div className="p-5">
              {result.error ? (
                <p className="text-sm text-red-600">{result.error}</p>
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {result.content || result.text || result.summary || JSON.stringify(result)}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {!selectedBill && (
        <div className="text-center py-12 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
          <p className="text-sm font-medium">Selecciona una medida para generar resúmenes</p>
          <p className="text-xs mt-1">Busca por número (PS1420) o título</p>
        </div>
      )}
    </div>
  );
}
