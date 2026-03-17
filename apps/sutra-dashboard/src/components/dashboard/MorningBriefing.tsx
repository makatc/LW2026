'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDashboardBriefing } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface BriefingItem {
  bill_number: string;
  title: string;
  event_type: 'fomb_blocked' | 'fiscal_note_new' | 'status_change';
  summary: string;
  urgency: 'critical' | 'urgent' | 'update';
  source_url?: string;
}

interface BriefingContent {
  date: string;
  critical: BriefingItem[];
  urgent: BriefingItem[];
  updates: BriefingItem[];
  fomb_feed: unknown[];
}

interface BriefingResponse {
  content: BriefingContent;
  cached: boolean;
  date: string;
  generated_at: string;
}

function BriefingItemCard({ item }: { item: BriefingItem }) {
  const urgencyConfig = {
    critical: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800', label: 'CRÍTICO' },
    urgent: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', label: 'URGENTE' },
    update: { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-700', label: 'ACTUALIZACIÓN' },
  };
  const cfg = urgencyConfig[item.urgency];

  return (
    <div className={`p-4 rounded-lg border ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-xs font-bold text-slate-900">{item.bill_number}</span>
        </div>
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex-shrink-0"
          >
            Ver doc →
          </a>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-800 mb-1 line-clamp-2">{item.title}</p>
      <p className="text-xs text-slate-600">{item.summary}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-lg border border-slate-200 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-16 bg-slate-200 rounded" />
        <div className="h-5 w-24 bg-slate-200 rounded" />
      </div>
      <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-full bg-slate-200 rounded" />
    </div>
  );
}

export default function MorningBriefing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<BriefingResponse>({
    queryKey: ['dashboard', 'briefing', user?.id],
    queryFn: () => fetchDashboardBriefing(user?.id),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
    fetchDashboardBriefing(user?.id, true).then(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
    });
  };

  const content = data?.content;
  const hasActivity = content && (
    content.critical.length > 0 ||
    content.urgent.length > 0 ||
    content.updates.length > 0
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-amber-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            Morning Briefing
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.cached && (
            <span className="text-xs text-slate-400">En caché</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <p className="text-xs text-slate-400 text-center py-6">No se pudo cargar el briefing.</p>
        ) : !hasActivity ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Sin actividad relevante en tu portafolio hoy.
          </p>
        ) : (
          <>
            {/* Critical */}
            {content!.critical.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
                  Crítico ({content!.critical.length})
                </h3>
                <div className="space-y-2">
                  {content!.critical.map((item, i) => (
                    <BriefingItemCard key={i} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Urgent */}
            {content!.urgent.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Urgente ({content!.urgent.length})
                </h3>
                <div className="space-y-2">
                  {content!.urgent.map((item, i) => (
                    <BriefingItemCard key={i} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Updates */}
            {content!.updates.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                  Actualizaciones ({content!.updates.length})
                </h3>
                <div className="space-y-2">
                  {content!.updates.map((item, i) => (
                    <BriefingItemCard key={i} item={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
