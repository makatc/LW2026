'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchFombRisk } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface SectorRisk {
  sector: string;
  measure_count: number;
  measures: { numero: string; titulo: string }[];
  fomb_risk_score: number;
  risk_level: 'low' | 'moderate' | 'high';
}

interface FombRiskData {
  sectors: SectorRisk[];
  overall_risk: number;
  risk_level: 'low' | 'moderate' | 'high';
  blocked_last_12m: number;
  total_actions_12m: number;
  recent_blocked: { law_number: string; bill_number: string; summary: string; fomb_letter_date: string }[];
}

const riskConfig = {
  low: { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Bajo' },
  moderate: { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Moderado' },
  high: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Alto' },
};

export default function FombRiskMeter() {
  const { user } = useAuth();
  const [showLegend, setShowLegend] = useState(false);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FombRiskData>({
    queryKey: ['dashboard', 'fomb-risk', user?.id],
    queryFn: () => fetchFombRisk(user?.id),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="mb-3">
            <div className="h-3 w-24 bg-slate-200 rounded mb-1" />
            <div className="h-4 w-full bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.sectors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Riesgo FOMB — Tu Portafolio</h2>
        <p className="text-xs text-slate-400 text-center py-4">
          Agrega medidas a tu Watchlist para ver el análisis de riesgo FOMB.
        </p>
      </div>
    );
  }

  const overallCfg = riskConfig[data.risk_level] || riskConfig.low;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Riesgo FOMB — Tu Portafolio</h2>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${overallCfg.bg}`}>
            <span className={`text-xs font-bold ${overallCfg.text}`}>
              {overallCfg.label} ({data.overall_risk}%)
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {data.blocked_last_12m} leyes bloqueadas de {data.total_actions_12m} acciones FOMB (últimos 12 meses)
        </p>
      </div>

      {/* Sectors */}
      <div className="p-5 space-y-4">
        {data.sectors.map(sector => {
          const cfg = riskConfig[sector.risk_level] || riskConfig.low;
          const isHovered = hoveredSector === sector.sector;

          return (
            <div
              key={sector.sector}
              className="relative"
              onMouseEnter={() => setHoveredSector(sector.sector)}
              onMouseLeave={() => setHoveredSector(null)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-800">
                  {sector.sector === 'bill' ? 'Proyecto de Ley' :
                   sector.sector === 'resolution' ? 'Resolución' :
                   sector.sector || 'General'}
                </span>
                <span className={`text-xs font-bold ${cfg.text}`}>
                  {sector.fomb_risk_score}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${cfg.color}`}
                  style={{ width: `${Math.min(sector.fomb_risk_score, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{sector.measure_count} medidas monitoreadas</p>

              {/* Tooltip */}
              {isHovered && sector.measures.length > 0 && (
                <div className="absolute z-10 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-3">
                  <p className="text-xs font-bold text-slate-700 mb-2">Medidas en este sector:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {sector.measures.slice(0, 5).map((m, i) => (
                      <p key={i} className="text-xs text-slate-600 line-clamp-1">
                        <span className="font-semibold">{m.numero}</span> — {m.titulo}
                      </p>
                    ))}
                    {sector.measures.length > 5 && (
                      <p className="text-xs text-slate-400">+{sector.measures.length - 5} más</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        <div>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3 h-3 transition-transform ${showLegend ? 'rotate-180' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
            ¿Cómo se calcula este score?
          </button>
          {showLegend && (
            <p className="text-xs text-slate-500 mt-2 p-3 bg-slate-50 rounded-lg">
              Score basado en acciones FOMB históricas en sectores similares a las medidas de tu portafolio.
              Verde (0-25): riesgo bajo. Amarillo (26-60): riesgo moderado. Rojo (61-100): riesgo alto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
