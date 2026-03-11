'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchLegislators } from '@/lib/api';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTIES = ['Todos', 'PNP', 'PPD', 'PD', 'MVC', 'PIP', 'Independiente'] as const;
const CHAMBERS = [
    { value: '', label: 'Todos' },
    { value: 'upper', label: 'Senado' },
    { value: 'lower', label: 'Cámara' },
] as const;

const PARTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    PNP: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    PPD: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    PD: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    MVC: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    PIP: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    Independiente: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    IND: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

const PARTY_DOT: Record<string, string> = {
    PNP: 'bg-blue-500',
    PPD: 'bg-red-500',
    PD: 'bg-green-500',
    MVC: 'bg-emerald-500',
    PIP: 'bg-orange-500',
    Independiente: 'bg-gray-400',
    IND: 'bg-gray-400',
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function LegisladoresPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [chamber, setChamber] = useState(searchParams.get('chamber') || '');
    const [party, setParty] = useState(searchParams.get('party') || '');
    const [search, setSearch] = useState(searchParams.get('search') || '');

    // Sync filters to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (chamber) params.set('chamber', chamber);
        if (party) params.set('party', party);
        if (search) params.set('search', search);
        const qs = params.toString();
        router.replace(`/legisladores${qs ? `?${qs}` : ''}`, { scroll: false });
    }, [chamber, party, search, router]);

    const { data, isLoading, error } = useQuery({
        queryKey: ['legislators', chamber, party],
        queryFn: () => fetchLegislators({
            chamber: chamber || undefined,
            party: party || undefined,
            limit: 200,
        }),
    });

    const legislators = data?.data || [];
    const filtered = useMemo(() =>
        legislators.filter((l: any) =>
            !search || l.full_name?.toLowerCase().includes(search.toLowerCase())
        ),
        [legislators, search]
    );

    const senators = filtered.filter((l: any) => l.chamber === 'upper');
    const reps = filtered.filter((l: any) => l.chamber === 'lower');

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 font-medium">Error cargando legisladores</p>
                <p className="text-sm text-red-500 mt-1">{(error as Error).message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Legisladores</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Asamblea Legislativa de Puerto Rico — Sesión 2025-2028
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">{filtered.length} legisladores</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="sticky top-0 z-10 bg-[#F5F6FA] py-3 -mt-3 -mx-6 px-6 border-b border-slate-200/60">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[220px] bg-white"
                        />
                    </div>

                    {/* Chamber toggle */}
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
                        {CHAMBERS.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setChamber(c.value)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                    chamber === c.value
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    {/* Party pills */}
                    <div className="flex flex-wrap gap-2">
                        {PARTIES.map(p => (
                            <button
                                key={p}
                                onClick={() => setParty(p === 'Todos' ? '' : p)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                    (p === 'Todos' && !party) || party === p
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'
                                }`}
                            >
                                {p === 'Todos' ? p : (
                                    <span className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${PARTY_DOT[p] || 'bg-gray-400'}`} />
                                        {p}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <SkeletonGrid />
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <div className="text-4xl mb-3">🏛️</div>
                    <p className="text-lg text-slate-500">No hay legisladores disponibles.</p>
                    <p className="text-sm text-slate-400 mt-2">Ajusta los filtros o ejecuta el scraper desde Admin → Scraper.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Senate section */}
                    {(chamber === '' || chamber === 'upper') && senators.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                Senado
                                <span className="text-sm font-normal text-slate-400 ml-1">({senators.length})</span>
                            </h2>
                            <LegislatorGrid legislators={senators} />
                        </section>
                    )}

                    {/* House section */}
                    {(chamber === '' || chamber === 'lower') && reps.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                Cámara de Representantes
                                <span className="text-sm font-normal text-slate-400 ml-1">({reps.length})</span>
                            </h2>
                            <LegislatorGrid legislators={reps} />
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Grid Component ───────────────────────────────────────────────────────────

function LegislatorGrid({ legislators }: { legislators: any[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {legislators.map((leg: any) => (
                <LegislatorCard key={leg.id} leg={leg} />
            ))}
        </div>
    );
}

// ─── Card Component ───────────────────────────────────────────────────────────

function LegislatorCard({ leg }: { leg: any }) {
    const colors = PARTY_COLORS[leg.party] || PARTY_COLORS['IND'];

    return (
        <Link
            href={`/legisladores/${leg.id}`}
            className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 group cursor-pointer"
        >
            <div className="flex items-center gap-3 mb-3">
                {leg.photo_url ? (
                    <img
                        src={leg.photo_url}
                        alt={leg.full_name}
                        className="w-12 h-12 rounded-full object-cover bg-slate-100 ring-2 ring-slate-100 group-hover:ring-indigo-100 transition-all"
                        onError={(e: any) => { e.target.style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 text-lg font-bold ring-2 ring-slate-100 group-hover:ring-indigo-100 transition-all">
                        {leg.full_name?.charAt(0)}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 leading-tight truncate group-hover:text-indigo-700 transition-colors">
                        {leg.full_name}
                    </p>
                    {leg.district && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{leg.district}</p>
                    )}
                </div>
            </div>

            {/* Party badge */}
            {leg.party && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PARTY_DOT[leg.party] || 'bg-gray-400'}`} />
                    {leg.party}
                </span>
            )}

            {/* Contact info */}
            <div className="mt-3 space-y-1">
                {leg.email && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                        <span className="text-slate-400">✉</span>
                        <span className="truncate">{leg.email}</span>
                    </p>
                )}
                {leg.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="text-slate-400">☎</span>
                        {leg.phone}
                    </p>
                )}
            </div>

            {/* Hover indicator */}
            <div className="mt-3 pt-2 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-indigo-500 font-medium flex items-center gap-1">
                    Ver ficha completa →
                </span>
            </div>
        </Link>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
    return (
        <div className="space-y-8">
            <div>
                <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-slate-200" />
                                <div className="flex-1">
                                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                                    <div className="h-3 w-1/2 bg-slate-200 rounded mt-1.5" />
                                </div>
                            </div>
                            <div className="h-6 w-16 bg-slate-200 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
