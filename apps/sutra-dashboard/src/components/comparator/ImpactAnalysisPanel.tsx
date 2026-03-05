'use client';

import { useState } from 'react';
import { Building2, Users, Briefcase, User, HelpCircle, TrendingUp, TrendingDown, Minus, GitMerge } from 'lucide-react';

interface StakeholderEntity {
  name: string;
  type: 'agencia' | 'corporacion' | 'grupo_demografico' | 'individuo' | 'otro';
  impactDirection: 'positivo' | 'restrictivo' | 'neutro' | 'mixto';
  impactDescription: string;
  timeframe: {
    shortTerm?: string;
    mediumTerm?: string;
    longTerm?: string;
  };
}

interface StakeholderAnalysis {
  entities: StakeholderEntity[];
  summary: string;
  overallImpact: 'positivo' | 'restrictivo' | 'neutro' | 'mixto';
}

interface ImpactAnalysisPanelProps {
  analysis: StakeholderAnalysis;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  agencia: <Building2 className="w-4 h-4" />,
  corporacion: <Briefcase className="w-4 h-4" />,
  grupo_demografico: <Users className="w-4 h-4" />,
  individuo: <User className="w-4 h-4" />,
  otro: <HelpCircle className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  agencia: 'Agencia Gubernamental',
  corporacion: 'Corporación / Empresa',
  grupo_demografico: 'Grupo Demográfico',
  individuo: 'Individuo / Ciudadano',
  otro: 'Otra Entidad',
};

const IMPACT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; bg: string; text: string; border: string; badge: string }
> = {
  positivo: {
    label: 'Impacto Positivo',
    icon: <TrendingUp className="w-4 h-4" />,
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
  restrictivo: {
    label: 'Impacto Restrictivo',
    icon: <TrendingDown className="w-4 h-4" />,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  neutro: {
    label: 'Impacto Neutro',
    icon: <Minus className="w-4 h-4" />,
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
  },
  mixto: {
    label: 'Impacto Mixto',
    icon: <GitMerge className="w-4 h-4" />,
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
  },
};

function EntityCard({ entity }: { entity: StakeholderEntity }) {
  const [expanded, setExpanded] = useState(false);
  const impact = IMPACT_CONFIG[entity.impactDirection] ?? IMPACT_CONFIG.neutro;
  const typeIcon = TYPE_ICONS[entity.type] ?? TYPE_ICONS.otro;
  const typeLabel = TYPE_LABELS[entity.type] ?? 'Entidad';

  const hasTimeframe =
    entity.timeframe.shortTerm || entity.timeframe.mediumTerm || entity.timeframe.longTerm;

  return (
    <div className={`rounded-lg border ${impact.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-start gap-3 p-4 text-left ${impact.bg} hover:brightness-95 transition-all`}
      >
        <div className={`flex-shrink-0 mt-0.5 ${impact.text}`}>{typeIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{entity.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{typeLabel}</p>
            </div>
            <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${impact.badge}`}>
              {impact.icon}
              {impact.label}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{entity.impactDescription}</p>
        </div>
      </button>

      {expanded && hasTimeframe && (
        <div className="p-4 border-t border-gray-100 bg-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Proyección Temporal
          </p>
          <div className="space-y-2">
            {entity.timeframe.shortTerm && (
              <div className="flex gap-3">
                <span className="flex-shrink-0 text-xs font-medium text-blue-600 w-28">Corto plazo</span>
                <span className="text-sm text-gray-700">{entity.timeframe.shortTerm}</span>
              </div>
            )}
            {entity.timeframe.mediumTerm && (
              <div className="flex gap-3">
                <span className="flex-shrink-0 text-xs font-medium text-indigo-600 w-28">Mediano plazo</span>
                <span className="text-sm text-gray-700">{entity.timeframe.mediumTerm}</span>
              </div>
            )}
            {entity.timeframe.longTerm && (
              <div className="flex gap-3">
                <span className="flex-shrink-0 text-xs font-medium text-purple-600 w-28">Largo plazo</span>
                <span className="text-sm text-gray-700">{entity.timeframe.longTerm}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ImpactAnalysisPanel({ analysis }: ImpactAnalysisPanelProps) {
  const overall = IMPACT_CONFIG[analysis.overallImpact] ?? IMPACT_CONFIG.neutro;

  const byType = analysis.entities.reduce(
    (acc, e) => {
      if (!acc[e.type]) acc[e.type] = [];
      acc[e.type].push(e);
      return acc;
    },
    {} as Record<string, StakeholderEntity[]>,
  );

  if (analysis.entities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">{analysis.summary}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall impact banner */}
      <div className={`rounded-xl border ${overall.border} ${overall.bg} p-4 flex items-start gap-3`}>
        <div className={`flex-shrink-0 mt-0.5 ${overall.text}`}>{overall.icon}</div>
        <div>
          <p className={`font-semibold text-sm ${overall.text}`}>
            Impacto General: {overall.label}
          </p>
          <p className="text-sm text-gray-700 mt-1">{analysis.summary}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {(['positivo', 'restrictivo', 'mixto', 'neutro'] as const).map((dir) => {
          const count = analysis.entities.filter((e) => e.impactDirection === dir).length;
          const cfg = IMPACT_CONFIG[dir];
          return (
            <div key={dir} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 text-center`}>
              <div className={`text-2xl font-bold ${cfg.text}`}>{count}</div>
              <div className="text-xs text-gray-600 mt-0.5">{cfg.label.split(' ')[1]}</div>
            </div>
          );
        })}
      </div>

      {/* Entities grouped by type */}
      <div className="space-y-4">
        {Object.entries(byType).map(([type, entities]) => (
          <div key={type}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              {TYPE_ICONS[type]}
              {TYPE_LABELS[type] ?? type} ({entities.length})
            </h4>
            <div className="space-y-2">
              {entities.map((entity, idx) => (
                <EntityCard key={idx} entity={entity} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
