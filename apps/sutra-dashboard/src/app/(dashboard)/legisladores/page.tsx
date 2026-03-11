'use client';

import { useEffect, useState } from 'react';
import { fetchLegislators } from '@/lib/api';

const PARTIES = ['Todos', 'PNP', 'PPD', 'PD', 'MVC', 'PIP', 'IND'];
const CHAMBERS = [
    { value: '', label: 'Todos' },
    { value: 'upper', label: 'Senado' },
    { value: 'lower', label: 'Cámara' },
];

const PARTY_COLORS: Record<string, string> = {
    PNP: 'bg-blue-100 text-blue-800',
    PPD: 'bg-red-100 text-red-800',
    PD: 'bg-green-100 text-green-800',
    MVC: 'bg-purple-100 text-purple-800',
    PIP: 'bg-yellow-100 text-yellow-800',
    IND: 'bg-gray-100 text-gray-700',
};

export default function LegisladoresPage() {
    const [legislators, setLegislators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [chamber, setChamber] = useState('');
    const [party, setParty] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        fetchLegislators({ chamber: chamber || undefined, party: party || undefined })
            .then(data => setLegislators(data?.data || []))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [chamber, party]);

    const filtered = legislators.filter(l =>
        !search || l.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">Error: {error}</p>
                <p className="text-sm text-red-500 mt-1">Verifica que el scraper de legisladores haya corrido.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Legisladores</h1>
                    <p className="text-slate-500 text-sm mt-1">Asamblea Legislativa de Puerto Rico — Sesión 2025-2028</p>
                </div>
                <span className="text-sm text-slate-400">{filtered.length} legisladores</span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-48"
                />

                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {CHAMBERS.map(c => (
                        <button
                            key={c.value}
                            onClick={() => setChamber(c.value)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                chamber === c.value
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2">
                    {PARTIES.map(p => (
                        <button
                            key={p}
                            onClick={() => setParty(p === 'Todos' ? '' : p)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                                (p === 'Todos' && !party) || party === p
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <p className="ml-3 text-slate-500">Cargando legisladores...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <p className="text-lg">No hay legisladores disponibles.</p>
                    <p className="text-sm mt-2">Ejecuta el scraper de legisladores desde Admin → Scraper para poblar los datos.</p>
                </div>
            ) : (
                <>
                    {/* Senate section */}
                    {(chamber === '' || chamber === 'upper') && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                                Senado
                                <span className="text-sm font-normal text-slate-400">
                                    ({filtered.filter(l => l.chamber === 'upper').length})
                                </span>
                            </h2>
                            <LegislatorGrid legislators={filtered.filter(l => l.chamber === 'upper')} />
                        </section>
                    )}

                    {/* House section */}
                    {(chamber === '' || chamber === 'lower') && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                Cámara de Representantes
                                <span className="text-sm font-normal text-slate-400">
                                    ({filtered.filter(l => l.chamber === 'lower').length})
                                </span>
                            </h2>
                            <LegislatorGrid legislators={filtered.filter(l => l.chamber === 'lower')} />
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

function LegislatorGrid({ legislators }: { legislators: any[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {legislators.map(leg => (
                <LegislatorCard key={leg.id} leg={leg} />
            ))}
        </div>
    );
}

function LegislatorCard({ leg }: { leg: any }) {
    const partyColor = PARTY_COLORS[leg.party] || 'bg-gray-100 text-gray-700';

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            {/* Photo */}
            <div className="flex items-center gap-3 mb-3">
                {leg.photo_url ? (
                    <img
                        src={leg.photo_url}
                        alt={leg.full_name}
                        className="w-12 h-12 rounded-full object-cover bg-slate-100"
                        onError={(e: any) => { e.target.src = ''; e.target.style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg font-bold">
                        {leg.full_name?.charAt(0)}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 leading-tight truncate">{leg.full_name}</p>
                    {leg.district && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{leg.district}</p>
                    )}
                </div>
            </div>

            {/* Party badge */}
            {leg.party && (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${partyColor}`}>
                    {leg.party}
                </span>
            )}

            {/* Contact */}
            <div className="mt-3 space-y-1">
                {leg.email && (
                    <a href={`mailto:${leg.email}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline truncate">
                        <span>✉</span>
                        <span className="truncate">{leg.email}</span>
                    </a>
                )}
                {leg.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <span>☎</span>
                        {leg.phone}
                    </p>
                )}
                {leg.office && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <span>🏛</span>
                        {leg.office}
                    </p>
                )}
            </div>
        </div>
    );
}
