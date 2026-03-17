'use client';

import { useState, useEffect } from 'react';
import { getPortfolioOverview, getViabilityScore, recalculateScore } from '@/lib/advanced-intelligence-api';

// ─── ScoreGauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Semi-circle: 180 degrees
  // Arc from 180° to 0° (left to right), sweeping clockwise
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * 0.78;
  const strokeWidth = size * 0.1;

  // Convert score (0-100) to angle in radians: starts at 180° (left), ends at 0° (right)
  const startAngle = Math.PI; // 180° in radians
  const endAngle = 0;
  const scoreAngle = startAngle - (clampedScore / 100) * Math.PI;

  function polarToCartesian(angle: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const progress = polarToCartesian(scoreAngle);

  // Background arc (full semicircle)
  const bgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  // Score arc
  const largeArc = clampedScore > 50 ? 1 : 0;
  const scorePath =
    clampedScore === 0
      ? ''
      : `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${progress.x} ${progress.y}`;

  // Color
  const color =
    clampedScore >= 67 ? '#16a34a' :  // green-600
    clampedScore >= 34 ? '#d97706' :  // amber-600
    '#dc2626';                         // red-600

  const fontSize = size * 0.2;
  const labelSize = size * 0.1;

  return (
    <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
      {/* Background track */}
      <path
        d={bgPath}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Score arc */}
      {scorePath && (
        <path
          d={scorePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
      {/* Score text */}
      <text
        x={cx}
        y={cy * 0.95}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="bold"
        fill={color}
      >
        {clampedScore}
      </text>
      <text
        x={cx}
        y={cy * 0.95 + fontSize * 0.85}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={labelSize}
        fill="#94a3b8"
      >
        / 100
      </text>
      {/* Min/Max labels */}
      <text x={strokeWidth / 2} y={cy * 0.98 + fontSize * 0.3} textAnchor="middle" fontSize={labelSize * 0.9} fill="#cbd5e1">0</text>
      <text x={size - strokeWidth / 2} y={cy * 0.98 + fontSize * 0.3} textAnchor="middle" fontSize={labelSize * 0.9} fill="#cbd5e1">100</text>
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceLabel(score: number): { label: string; bg: string; text: string } {
  if (score >= 70) return { label: 'Alta confianza', bg: 'bg-green-100', text: 'text-green-800' };
  if (score >= 40) return { label: 'Media confianza', bg: 'bg-amber-100', text: 'text-amber-800' };
  return { label: 'Baja confianza', bg: 'bg-red-100', text: 'text-red-800' };
}

// ─── BillScoreCard ────────────────────────────────────────────────────────────

function BillScoreCard({ item, onSelect }: { item: any; onSelect: () => void }) {
  const score = item.viability_score ?? item.score ?? 0;
  const conf = confidenceLabel(score);
  return (
    <button
      onClick={onSelect}
      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-violet-300 hover:shadow-sm transition-all text-center"
    >
      <ScoreGauge score={score} size={100} />
      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.bill_number || item.measure_number}</p>
      <p className="text-xs text-slate-500 line-clamp-2">{item.bill_title || item.short_title || item.title}</p>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conf.bg} ${conf.text}`}>
        {conf.label}
      </span>
    </button>
  );
}

// ─── FactorBar ────────────────────────────────────────────────────────────────

function FactorBar({ factor }: { factor: { name: string; delta: number; description?: string } }) {
  const isPositive = factor.delta > 0;
  const isNegative = factor.delta < 0;
  const absWidth = Math.min(Math.abs(factor.delta) * 2, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">{factor.name}</p>
        <span className={`text-xs font-bold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-400'}`}>
          {isPositive ? '+' : ''}{factor.delta}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isPositive ? 'bg-green-500' : isNegative ? 'bg-red-500' : 'bg-slate-300'}`}
          style={{ width: `${absWidth}%` }}
        />
      </div>
      {factor.description && (
        <p className="text-xs text-slate-500">{factor.description}</p>
      )}
    </div>
  );
}

// ─── BillDetail ───────────────────────────────────────────────────────────────

function BillDetail({
  item,
  token,
  onBack,
}: {
  item: any;
  token: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<any>(item);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!item.id) return;
    getViabilityScore(item.id, token)
      .then(setDetail)
      .catch(() => {});
  }, [item.id, token]);

  async function handleRecalculate() {
    if (!item.id) return;
    setRecalculating(true);
    try {
      const updated = await recalculateScore(item.id, token);
      setDetail(updated);
    } catch (_) {}
    setRecalculating(false);
  }

  const score = detail.viability_score ?? detail.score ?? 0;
  const conf = confidenceLabel(score);
  const factors: any[] = detail.factors || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Volver al portafolio
        </button>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-bold text-slate-900">{detail.bill_number || detail.measure_number}</span>
      </div>

      {/* Large gauge */}
      <div className="flex flex-col items-center gap-3">
        <ScoreGauge score={score} size={200} />
        <div className="flex items-center gap-3">
          <p className="text-base font-bold text-slate-900">{detail.bill_title || detail.title || detail.short_title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${conf.bg} ${conf.text}`}>
            {conf.label}
          </span>
          {detail.last_calculated && (
            <span className="text-xs text-slate-400">
              Calculado {new Date(detail.last_calculated).toLocaleDateString('es-PR')}
            </span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="text-xs px-3 py-1 bg-violet-600 text-white rounded-full font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {recalculating ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Recalculando...
              </span>
            ) : 'Recalcular'}
          </button>
        </div>
      </div>

      {/* Factor breakdown */}
      {factors.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-4">
            Factores de Viabilidad
          </h3>
          <div className="space-y-4">
            {factors.map((f: any, i: number) => (
              <FactorBar key={i} factor={f} />
            ))}
          </div>
        </div>
      )}

      {/* No factors placeholder */}
      {factors.length === 0 && (
        <div className="text-center py-8 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <p className="text-sm">El desglose de factores estará disponible tras el primer cálculo.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function PredictiveTab() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    if (!token) return;
    getPortfolioOverview(token)
      .then(setPortfolio)
      .catch(() => setPortfolio([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (selected) {
    return <BillDetail item={selected} token={token} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Portafolio — Viabilidad Legislativa</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Score 0-100 basado en historial de votos, comités asignados y factores políticos
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />67-100: Viable</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />34-66: Incierto</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />0-33: Baja viabilidad</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="h-16 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-20 bg-slate-200 rounded mx-auto mb-1" />
              <div className="h-3 w-32 bg-slate-200 rounded mx-auto" />
            </div>
          ))}
        </div>
      ) : portfolio.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <p className="text-sm font-medium">Sin medidas en tu portafolio</p>
          <p className="text-xs mt-1">Agrega medidas a tu watchlist para ver el análisis predictivo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {portfolio.map((item: any) => (
            <BillScoreCard
              key={item.id || item.bill_id}
              item={item}
              onSelect={() => setSelected(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
