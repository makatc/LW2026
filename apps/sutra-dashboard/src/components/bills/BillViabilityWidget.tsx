'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViabilityScore {
    bill_id: string;
    score: number;              // 0-100
    confidence: 'alta' | 'media' | 'baja';
    label: string;              // e.g. "Alta viabilidad"
    factors?: {
        name: string;
        weight: number;
        direction: 'positive' | 'negative' | 'neutral';
    }[];
    computed_at?: string;
}

interface BillViabilityWidgetProps {
    billId: string;
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
}

function getScoreRingColor(score: number): string {
    if (score >= 70) return '#10b981';  // emerald-500
    if (score >= 40) return '#f59e0b';  // amber-500
    return '#ef4444';                   // red-500
}

function getScoreBg(score: number): string {
    if (score >= 70) return 'bg-emerald-50 border-emerald-200';
    if (score >= 40) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
}

function getConfidenceBadge(confidence: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
        alta:  { label: 'Alta confianza',  color: 'bg-emerald-100 text-emerald-700' },
        media: { label: 'Confianza media', color: 'bg-amber-100 text-amber-700' },
        baja:  { label: 'Baja confianza',  color: 'bg-slate-100 text-slate-600' },
    };
    return map[confidence] || { label: confidence, color: 'bg-slate-100 text-slate-600' };
}

// ─── Gauge SVG ────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
    const radius = 36;
    const circumference = Math.PI * radius;   // half-circle
    const pct = Math.min(100, Math.max(0, score)) / 100;
    const strokeDashoffset = circumference * (1 - pct);
    const color = getScoreRingColor(score);

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width="100" height="58" viewBox="0 0 100 58" className="overflow-visible">
                {/* Track */}
                <path
                    d={`M 12,50 A ${radius},${radius} 0 0 1 88,50`}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                {/* Progress */}
                <path
                    d={`M 12,50 A ${radius},${radius} 0 0 1 88,50`}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
            </svg>
            <div className="absolute bottom-0 text-center">
                <div className={`text-2xl font-bold leading-none ${getScoreColor(score)}`}>
                    {score}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">/ 100</div>
            </div>
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BillViabilityWidget({ billId }: BillViabilityWidgetProps) {
    const router = useRouter();
    const [viability, setViability] = useState<ViabilityScore | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!billId) return;
        setLoading(true);
        fetchWithAuth(`/api/bills/${billId}/viability-score`)
            .then((data: any) => {
                if (data && typeof data.score === 'number') {
                    setViability(data);
                } else {
                    setViability(null);
                }
            })
            .catch(() => setViability(null))
            .finally(() => setLoading(false));
    }, [billId]);

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="h-28 bg-slate-100 rounded-lg animate-pulse" />
            </div>
        );
    }

    if (error || !viability) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Análisis Predictivo</h3>
                    <span className="text-xs text-slate-400">Beta</span>
                </div>
                <div className="text-center py-6">
                    <div className="text-3xl mb-3">🔮</div>
                    <p className="text-sm text-slate-500 mb-1">Score de viabilidad no disponible</p>
                    <p className="text-xs text-slate-400">
                        El módulo predictivo requiere más datos históricos de votaciones para esta medida.
                    </p>
                </div>
                <button
                    onClick={() => router.push(`/inteligencia-avanzada/predictivo?bill_id=${billId}`)}
                    className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-medium py-2 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                    Ver Análisis Completo →
                </button>
            </div>
        );
    }

    const badgeStyle = getConfidenceBadge(viability.confidence);
    const bgColor = getScoreBg(viability.score);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Viabilidad Legislativa</h3>
                <span className="text-xs text-slate-400">Beta · IA</span>
            </div>

            {/* Score area */}
            <div className={`p-5 border-b border-slate-100 ${bgColor}`}>
                <div className="flex items-center gap-5">
                    <ScoreGauge score={viability.score} />
                    <div>
                        <p className={`text-lg font-bold ${getScoreColor(viability.score)} leading-tight`}>
                            {viability.label}
                        </p>
                        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyle.color}`}>
                            {badgeStyle.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Factors */}
            {viability.factors && viability.factors.length > 0 && (
                <div className="px-5 py-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Factores</p>
                    {viability.factors.slice(0, 4).map((factor, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    factor.direction === 'positive' ? 'bg-emerald-400'
                                    : factor.direction === 'negative' ? 'bg-red-400'
                                    : 'bg-slate-300'
                                }`} />
                                <span className="text-xs text-slate-700 truncate">{factor.name}</span>
                            </div>
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full shrink-0 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${
                                        factor.direction === 'positive' ? 'bg-emerald-400'
                                        : factor.direction === 'negative' ? 'bg-red-400'
                                        : 'bg-slate-300'
                                    }`}
                                    style={{ width: `${Math.abs(factor.weight) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CTA */}
            <div className="px-5 pb-4">
                <button
                    onClick={() => router.push(`/inteligencia-avanzada/predictivo?bill_id=${billId}`)}
                    className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-medium py-2 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                    Ver Análisis Completo →
                </button>
            </div>
        </div>
    );
}
