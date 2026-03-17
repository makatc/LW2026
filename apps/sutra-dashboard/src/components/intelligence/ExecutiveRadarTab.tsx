'use client';

import { useState, useEffect } from 'react';
import { getExecutiveOrders, getUserAlerts, dismissAlert } from '@/lib/advanced-intelligence-api';

const SECTORS = ['Todos', 'Energía', 'Permisos', 'Salud', 'Educación', 'Fiscal', 'Laboral'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

interface ExecutiveOrder {
  id: string;
  order_number: string;
  title: string;
  issued_date: string;
  sectors: string[];
  ai_summary?: string;
  pdf_url?: string;
  agencies?: string[];
  referenced_legislation?: string[];
  full_analysis?: string;
}

interface Alert {
  id: string;
  order_id: string;
  order_number: string;
  message: string;
  read: boolean;
}

function OECard({
  order,
  alert,
  onDismiss,
}: {
  order: ExecutiveOrder;
  alert?: Alert;
  onDismiss?: (alertId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const dateStr = order.issued_date
    ? new Date(order.issued_date).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${alert ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-900">{order.order_number}</span>
              <span className="text-xs text-slate-400">{dateStr}</span>
              {alert && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                  Afecta tu portafolio
                </span>
              )}
              {order.sectors?.map((s) => (
                <span key={s} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                  {s}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2">{order.title}</p>
            {order.ai_summary && (
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{order.ai_summary}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {order.pdf_url && (
              <a
                href={order.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Ver PDF
              </a>
            )}
            {alert && onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                className="text-xs px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition-colors"
              >
                Leído
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs px-2.5 py-1.5 bg-violet-100 text-violet-700 rounded-lg font-medium hover:bg-violet-200 transition-colors"
            >
              {expanded ? 'Colapsar' : 'Detalles'}
            </button>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {order.agencies && order.agencies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Agencias involucradas</p>
                <div className="flex flex-wrap gap-1.5">
                  {order.agencies.map((a) => (
                    <span key={a} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {order.referenced_legislation && order.referenced_legislation.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Legislación referenciada</p>
                <div className="flex flex-wrap gap-1.5">
                  {order.referenced_legislation.map((l) => (
                    <span key={l} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {order.full_analysis && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Análisis completo</p>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{order.full_analysis}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-slate-200 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
          <div className="h-4 w-3/4 bg-slate-200 rounded" />
          <div className="h-3 w-full bg-slate-200 rounded" />
          <div className="h-3 w-2/3 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveRadarTab() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [sector, setSector] = useState('Todos');
  const [year, setYear] = useState<number | undefined>(undefined);
  const [orders, setOrders] = useState<ExecutiveOrder[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const filters: any = {};
    if (sector !== 'Todos') filters.sector = sector;
    if (year) filters.year = year;

    Promise.all([
      getExecutiveOrders(filters, token || undefined),
      token ? getUserAlerts(token) : Promise.resolve([]),
    ])
      .then(([ordersRes, alertsRes]) => {
        setOrders(ordersRes?.data || []);
        setAlerts(alertsRes || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sector, year, token]);

  function handleDismiss(alertId: string) {
    if (!token) return;
    dismissAlert(alertId, token)
      .then(() => setAlerts((prev) => prev.filter((a) => a.id !== alertId)))
      .catch(() => {});
  }

  const unreadAlerts = alerts.filter((a) => !a.read);
  const alertOrderIds = new Set(unreadAlerts.map((a) => a.order_id));

  return (
    <div className="space-y-5">
      {/* Alert banner */}
      {unreadAlerts.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-600 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-sm font-medium text-amber-800">
            Tienes {unreadAlerts.length} orden{unreadAlerts.length !== 1 ? 'es' : ''} ejecutiva{unreadAlerts.length !== 1 ? 's' : ''} que afectan medidas de tu portafolio
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sector badges */}
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                sector === s
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400 hover:text-violet-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Year filter */}
        <select
          value={year || ''}
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todos los años</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">No se pudieron cargar las órdenes ejecutivas.</p>
          <p className="text-xs mt-1 text-red-500">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
          <p className="text-sm font-medium">Sin órdenes ejecutivas para estos filtros</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OECard
              key={order.id}
              order={order}
              alert={alertOrderIds.has(order.id) ? unreadAlerts.find((a) => a.order_id === order.id) : undefined}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
