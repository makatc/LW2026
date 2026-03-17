'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBillsEnhanced, fetchBillsSummary } from '@/lib/api';
import ComparatorLink from '@/components/bills/ComparatorLink';

const PAGE_SIZE = 50;

const BILL_TYPES = [
    { value: '', label: 'Todos' },
    { value: 'bill', label: 'Proyectos' },
    { value: 'resolution', label: 'Resoluciones' },
    { value: 'other', label: 'Otros' },
];

const BILL_TYPE_LABELS: Record<string, string> = {
    bill: 'Proyecto',
    resolution: 'Resolución',
    other: 'Otro',
};

const BILL_TYPE_COLORS: Record<string, string> = {
    bill: 'bg-blue-100 text-blue-800',
    resolution: 'bg-purple-100 text-purple-800',
    other: 'bg-slate-100 text-slate-700',
};

export default function MedidasPage() {
    const [bills, setBills] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [billType, setBillType] = useState('');
    const [page, setPage] = useState(0);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [debouncedSearch, billType]);

    // Fetch bills
    const loadBills = useCallback(() => {
        setLoading(true);
        fetchBillsEnhanced({
            search: debouncedSearch || undefined,
            bill_type: billType || undefined,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
        })
            .then(data => {
                setBills(data?.data || data?.bills || []);
                setTotal(data?.total ?? (data?.bills?.length || 0));
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [debouncedSearch, billType, page]);

    useEffect(() => { loadBills(); }, [loadBills]);

    // Fetch summary once
    useEffect(() => {
        fetchBillsSummary().then(setSummary).catch(() => {});
    }, []);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Medidas Legislativas</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Proyectos y resoluciones radicados en la Asamblea Legislativa de Puerto Rico
                    </p>
                </div>
                {summary && (
                    <div className="flex gap-4 text-right">
                        <Stat label="Total" value={summary.total} />
                        <Stat label="Proyectos" value={summary.bills_count} color="text-blue-600" />
                        <Stat label="Resoluciones" value={summary.resolutions_count} color="text-purple-600" />
                        <Stat label="Esta semana" value={summary.recent_count} color="text-emerald-600" />
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-56">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar por número, título o extracto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {BILL_TYPES.map(t => (
                        <button
                            key={t.value}
                            onClick={() => setBillType(t.value)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                billType === t.value
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <span className="text-sm text-slate-400 ml-auto">
                    {total.toLocaleString()} medidas
                </span>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <span className="text-red-600 font-medium">Error:</span>
                    <span className="text-red-700 text-sm">{error}</span>
                    <button
                        onClick={loadBills}
                        className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        <p className="ml-3 text-slate-500">Cargando medidas...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">Número</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700">Título</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700">Comisión</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700">Autor</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700">Estado</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">Fecha</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">Comparar</th>
                                    <th className="px-5 py-3 font-semibold text-slate-700"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bills.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                                            <p className="text-lg mb-1">No se encontraron medidas</p>
                                            <p className="text-sm">
                                                {debouncedSearch || billType
                                                    ? 'Intenta con otros filtros de búsqueda.'
                                                    : 'Ejecuta el scraper de medidas desde Admin → Scrapers para poblar los datos.'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    bills.map(bill => (
                                        <BillRow key={bill.id} bill={bill} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="px-3 py-1.5 text-sm text-slate-600">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BillRow({ bill }: { bill: any }) {
    const router = useRouter();
    const typeColor = BILL_TYPE_COLORS[bill.bill_type] || BILL_TYPE_COLORS.other;
    const typeLabel = BILL_TYPE_LABELS[bill.bill_type] || bill.bill_type || '—';

    const fecha = bill.fecha
        ? new Date(bill.fecha).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' })
        : null;

    return (
        <tr
            className="hover:bg-slate-50 transition-colors cursor-pointer"
            onClick={() => router.push(`/medidas/${bill.id}`)}
        >
            <td className="px-5 py-3 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-900">{bill.numero || 'S/N'}</span>
                    <span className={`inline-flex self-start px-1.5 py-0.5 rounded text-xs font-medium ${typeColor}`}>
                        {typeLabel}
                    </span>
                </div>
            </td>
            <td className="px-5 py-3 max-w-xs">
                <p className="line-clamp-2 text-slate-700 leading-snug" title={bill.titulo}>
                    {bill.titulo || '—'}
                </p>
            </td>
            <td className="px-5 py-3 text-slate-500 text-xs max-w-[160px]">
                <p className="line-clamp-2" title={bill.commission_name}>
                    {bill.commission_name || '—'}
                </p>
            </td>
            <td className="px-5 py-3 text-slate-500 text-xs max-w-[140px]">
                <p className="line-clamp-1" title={bill.author}>
                    {bill.author || '—'}
                </p>
            </td>
            <td className="px-5 py-3">
                {bill.status ? (
                    <StatusBadge status={bill.status} />
                ) : (
                    <span className="text-slate-300 text-xs">—</span>
                )}
            </td>
            <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                {fecha || '—'}
            </td>
            <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                <ComparatorLink
                    billId={bill.id}
                    billNumber={bill.numero}
                    billTitle={bill.titulo}
                    hasVersions={!!(bill.versions_count && bill.versions_count >= 1)}
                />
            </td>
            <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                <a
                    href={bill.source_url || `https://sutra.oslpr.org/osl/medida/${bill.numero}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium hover:underline whitespace-nowrap"
                >
                    SUTRA ↗
                </a>
            </td>
        </tr>
    );
}

function StatusBadge({ status }: { status: string }) {
    const lower = status.toLowerCase();
    let color = 'bg-slate-100 text-slate-600';
    if (lower.includes('aprobado') || lower.includes('firmado')) color = 'bg-green-100 text-green-800';
    else if (lower.includes('rechazado') || lower.includes('vetado')) color = 'bg-red-100 text-red-800';
    else if (lower.includes('comisión') || lower.includes('referido')) color = 'bg-yellow-100 text-yellow-800';
    else if (lower.includes('pendiente')) color = 'bg-orange-100 text-orange-700';

    return (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${color} max-w-[130px] truncate`} title={status}>
            {status}
        </span>
    );
}

function Stat({ label, value, color = 'text-slate-900' }: { label: string; value: any; color?: string }) {
    return (
        <div>
            <div className={`text-xl font-bold ${color}`}>{value ?? '—'}</div>
            <div className="text-xs text-slate-400">{label}</div>
        </div>
    );
}
