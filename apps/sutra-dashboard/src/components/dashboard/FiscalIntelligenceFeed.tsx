'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFombRecent, fetchFiscalNotes, fetchFiscalNotesByBill, fetchFombActionsByBill } from '@/lib/api';

const AGENCY_COLORS: Record<string, string> = {
  OGP: 'bg-blue-100 text-blue-800',
  Hacienda: 'bg-green-100 text-green-800',
  Justicia: 'bg-purple-100 text-purple-800',
  Salud: 'bg-pink-100 text-pink-800',
};

const STATUS_COLORS: Record<string, string> = {
  blocked: 'bg-red-100 text-red-800',
  under_review: 'bg-amber-100 text-amber-800',
  compliant: 'bg-green-100 text-green-800',
  negotiating: 'bg-blue-100 text-blue-800',
};

const STATUS_LABELS: Record<string, string> = {
  blocked: 'Bloqueado',
  under_review: 'En revisión',
  compliant: 'Cumple',
  negotiating: 'Negociando',
};

const IMPACT_COLORS: Record<string, string> = {
  cost: 'bg-red-100 text-red-800',
  saving: 'bg-green-100 text-green-800',
  revenue: 'bg-blue-100 text-blue-800',
  neutral: 'bg-slate-100 text-slate-800',
  undetermined: 'bg-gray-100 text-gray-700',
};

const IMPACT_LABELS: Record<string, string> = {
  cost: 'Costo',
  saving: 'Ahorro',
  revenue: 'Ingreso',
  neutral: 'Neutral',
  undetermined: 'Por determinar',
};

function FombTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['fomb-recent', statusFilter, offset],
    queryFn: () => fetchFombRecent({ status: statusFilter || undefined, limit, offset }),
  });

  const items = (data as any)?.data || [];
  const total = (data as any)?.total || 0;

  return (
    <div>
      {/* Filter */}
      <div className="mb-3 flex gap-2 flex-wrap">
        {['', 'blocked', 'under_review', 'compliant', 'negotiating'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setOffset(0); }}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
            }`}
          >
            {s === '' ? 'Todas' : STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No hay acciones FOMB recientes.</p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item: any) => (
              <div key={item.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${STATUS_COLORS[item.implementation_status] || 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABELS[item.implementation_status] || item.implementation_status}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{item.law_number || item.bill_number || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.fomb_letter_date && (
                      <span className="text-xs text-slate-400">
                        {new Date(item.fomb_letter_date).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {item.fomb_letter_url && (
                      <a href={item.fomb_letter_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{item.summary}</p>
              </div>
            ))}
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-400">{total} acciones</p>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="text-xs px-2 py-1 border rounded disabled:opacity-40">←</button>
              <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="text-xs px-2 py-1 border rounded disabled:opacity-40">→</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotesTab() {
  const [agencyFilter, setAgencyFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['fiscal-notes', agencyFilter, offset],
    queryFn: () => fetchFiscalNotes({ agency: agencyFilter || undefined, limit, offset }),
  });

  const items = (data as any)?.data || [];
  const total = (data as any)?.total || 0;

  return (
    <div>
      <div className="mb-3 flex gap-2 flex-wrap">
        {['', 'OGP', 'Hacienda', 'Justicia', 'Salud'].map(a => (
          <button
            key={a}
            onClick={() => { setAgencyFilter(a); setOffset(0); }}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              agencyFilter === a
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
            }`}
          >
            {a || 'Todas'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No hay memoriales fiscales.</p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item: any) => (
              <div key={item.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${AGENCY_COLORS[item.source_agency] || 'bg-slate-100 text-slate-700'}`}>
                      {item.source_agency}
                    </span>
                    {item.bill_number && <span className="text-xs font-bold text-slate-900">{item.bill_number}</span>}
                    {item.fiscal_impact_type && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${IMPACT_COLORS[item.fiscal_impact_type] || 'bg-slate-100 text-slate-700'}`}>
                        {IMPACT_LABELS[item.fiscal_impact_type] || item.fiscal_impact_type}
                      </span>
                    )}
                  </div>
                  {item.published_at && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(item.published_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-800 font-medium line-clamp-1">{item.title}</p>
                {item.bill_title && <p className="text-xs text-slate-500 line-clamp-1">{item.bill_title}</p>}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-400">{total} memoriales</p>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="text-xs px-2 py-1 border rounded disabled:opacity-40">←</button>
              <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="text-xs px-2 py-1 border rounded disabled:opacity-40">→</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ByBillTab() {
  const [search, setSearch] = useState('');
  const [selectedBillId, setSelectedBillId] = useState('');

  const { data: notes } = useQuery({
    queryKey: ['fiscal-notes-bill', selectedBillId],
    queryFn: () => fetchFiscalNotesByBill(selectedBillId),
    enabled: !!selectedBillId,
  });

  const { data: fombActions } = useQuery({
    queryKey: ['fomb-actions-bill', selectedBillId],
    queryFn: () => fetchFombActionsByBill(selectedBillId),
    enabled: !!selectedBillId,
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="UUID de la medida..."
          className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setSelectedBillId(search.trim())}
          disabled={!search.trim()}
          className="text-xs px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-40"
        >
          Buscar
        </button>
      </div>

      {selectedBillId && (
        <div className="space-y-4">
          {/* Fiscal Notes */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">
              Memoriales Fiscales ({(notes as any[])?.length || 0})
            </h4>
            {(notes as any[] || []).length === 0 ? (
              <p className="text-xs text-slate-400">No hay memoriales para esta medida.</p>
            ) : (
              <div className="space-y-2">
                {(notes as any[]).map(n => (
                  <div key={n.id} className="p-2 border border-slate-200 rounded text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${AGENCY_COLORS[n.source_agency] || 'bg-slate-100 text-slate-700'}`}>{n.source_agency}</span>
                    <span className="ml-2 text-slate-700">{n.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FOMB Actions */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">
              Acciones FOMB ({(fombActions as any[])?.length || 0})
            </h4>
            {(fombActions as any[] || []).length === 0 ? (
              <p className="text-xs text-slate-400">No hay acciones FOMB para esta medida.</p>
            ) : (
              <div className="space-y-2">
                {(fombActions as any[]).map((a: any) => (
                  <div key={a.id} className="p-2 border border-slate-200 rounded text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[a.implementation_status] || 'bg-slate-100'}`}>{STATUS_LABELS[a.implementation_status]}</span>
                    <span className="ml-2 text-slate-700">{a.law_number || a.bill_number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FiscalIntelligenceFeed() {
  const [activeTab, setActiveTab] = useState<'fomb' | 'notes' | 'byBill'>('fomb');

  const tabs = [
    { key: 'fomb', label: 'FOMB' },
    { key: 'notes', label: 'Memoriales Fiscales' },
    { key: 'byBill', label: 'Por Medida' },
  ] as const;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">Inteligencia Fiscal</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100 px-5">
        <div className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-xs py-3 font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'fomb' && <FombTab />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'byBill' && <ByBillTab />}
      </div>
    </div>
  );
}
