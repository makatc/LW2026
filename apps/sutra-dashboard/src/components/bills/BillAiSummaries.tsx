'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type SummaryType = 'ejecutivo' | 'tecnico_legal' | 'tweet';

interface AiSummary {
    id: string;
    summary_type: SummaryType;
    content: string;
    generated_at: string;
    model?: string;
}

interface BillAiSummariesProps {
    billId: string;
    billNumber: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUMMARY_TYPES: { id: SummaryType; label: string; icon: string; description: string }[] = [
    { id: 'ejecutivo', label: 'Ejecutivo', icon: '📋', description: 'Resumen ejecutivo para tomadores de decisiones' },
    { id: 'tecnico_legal', label: 'Técnico-Legal', icon: '⚖️', description: 'Análisis técnico-legal de las disposiciones' },
    { id: 'tweet', label: 'Tweet', icon: '🐦', description: 'Resumen en 280 caracteres para redes sociales' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillAiSummaries({ billId, billNumber }: BillAiSummariesProps) {
    const [summaries, setSummaries] = useState<Partial<Record<SummaryType, AiSummary>>>({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<SummaryType | null>(null);
    const [activeType, setActiveType] = useState<SummaryType>('ejecutivo');
    const [error, setError] = useState<string | null>(null);

    // Load existing summaries
    useEffect(() => {
        if (!billId) return;
        setLoading(true);
        fetchWithAuth(`/api/bills/${billId}/summaries`)
            .then((data: any) => {
                const map: Partial<Record<SummaryType, AiSummary>> = {};
                const items: AiSummary[] = Array.isArray(data) ? data : (data?.data || []);
                items.forEach((s: AiSummary) => { map[s.summary_type] = s; });
                setSummaries(map);
            })
            .catch(() => {
                // Endpoint may not exist yet — silently degrade
                setSummaries({});
            })
            .finally(() => setLoading(false));
    }, [billId]);

    async function handleGenerate(type: SummaryType) {
        setGenerating(type);
        setError(null);
        try {
            const data: any = await fetchWithAuth(`/api/bills/${billId}/summaries/generate`, {
                method: 'POST',
                body: JSON.stringify({ summary_type: type }),
            });
            if (data) {
                setSummaries(prev => ({ ...prev, [type]: data }));
                setActiveType(type);
            }
        } catch (e: any) {
            setError(e.message || 'Error al generar el resumen. Verifica que GEMINI_API_KEY esté configurado.');
        } finally {
            setGenerating(null);
        }
    }

    function fmtDate(dateStr: string): string {
        try {
            return new Date(dateStr).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    const activeSummary = summaries[activeType];

    return (
        <div className="space-y-4">
            {/* Type selector */}
            <div className="flex gap-2 flex-wrap">
                {SUMMARY_TYPES.map(t => {
                    const hasSummary = !!summaries[t.id];
                    const isActive = activeType === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveType(t.id)}
                            title={t.description}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                                isActive
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300 hover:text-indigo-700'
                            }`}
                        >
                            <span>{t.icon}</span>
                            {t.label}
                            {hasSummary && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Error banner */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {error}
                </div>
            )}

            {/* Content area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                {loading ? (
                    <div className="p-8 flex items-center justify-center gap-3 text-slate-400">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                        <span className="text-sm">Cargando resúmenes...</span>
                    </div>
                ) : activeSummary ? (
                    <div className="p-6 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{SUMMARY_TYPES.find(t => t.id === activeType)?.icon}</span>
                                <span className="font-semibold text-slate-800">
                                    Resumen {SUMMARY_TYPES.find(t => t.id === activeType)?.label}
                                </span>
                                {activeSummary.model && (
                                    <span className="text-xs text-slate-400 font-normal">
                                        · {activeSummary.model}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">
                                    {fmtDate(activeSummary.generated_at)}
                                </span>
                                <button
                                    onClick={() => handleGenerate(activeType)}
                                    disabled={generating === activeType}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40"
                                >
                                    {generating === activeType ? 'Regenerando...' : 'Regenerar'}
                                </button>
                            </div>
                        </div>

                        {/* Summary content */}
                        <div className={`rounded-xl p-5 ${
                            activeType === 'tweet'
                                ? 'bg-sky-50 border border-sky-100'
                                : activeType === 'tecnico_legal'
                                ? 'bg-slate-50 border border-slate-200 font-mono text-xs'
                                : 'bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100'
                        }`}>
                            <p className={`leading-relaxed text-slate-800 ${
                                activeType === 'tweet' ? 'text-base' : 'text-sm'
                            }`}>
                                {activeSummary.content}
                            </p>
                            {activeType === 'tweet' && (
                                <p className={`text-xs mt-2 ${
                                    activeSummary.content.length > 280
                                        ? 'text-red-500'
                                        : 'text-slate-400'
                                }`}>
                                    {activeSummary.content.length}/280 caracteres
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center">
                        <div className="text-4xl mb-3">
                            {SUMMARY_TYPES.find(t => t.id === activeType)?.icon}
                        </div>
                        <p className="font-medium text-slate-700 mb-1">
                            No hay resumen {SUMMARY_TYPES.find(t => t.id === activeType)?.label.toLowerCase()} aún
                        </p>
                        <p className="text-sm text-slate-400 mb-5">
                            {SUMMARY_TYPES.find(t => t.id === activeType)?.description}
                        </p>
                        <button
                            onClick={() => handleGenerate(activeType)}
                            disabled={!!generating}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            {generating === activeType ? (
                                <>
                                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    ✨ Generar con IA
                                </>
                            )}
                        </button>
                        <p className="text-xs text-slate-400 mt-3">
                            Requiere <code className="bg-slate-100 px-1 rounded">GEMINI_API_KEY</code> configurado en sutra-monitor
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
