'use client';

import { useEffect, useState } from 'react';
import { fetchMeasures } from '@/lib/api';

export default function MedidasPage() {
    const [measures, setMeasures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchMeasures()
            .then(data => {
                setMeasures(data.measures || []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="ml-4 text-slate-500">Cargando medidas...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="text-red-600 text-xl font-bold">⚠️ Error al cargar medidas</div>
                <p className="text-slate-500">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Medidas Legislativas</h2>
                    <p className="text-slate-500">Hallazgos recientes del monitor legislativo.</p>
                </div>
                <div className="bg-white p-2 border rounded-lg shadow-sm text-sm text-slate-500">
                    Total: <span className="font-bold text-slate-900">{measures.length}</span>
                </div>
            </header>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Medida</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 w-1/3">Título</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Fecha</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Autor(es)</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Link</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {measures.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No se encontraron medidas recientes.
                                    </td>
                                </tr>
                            ) : (
                                measures.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                            {m.numero || 'S/N'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="line-clamp-2" title={m.titulo}>
                                                {m.titulo}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {m.fecha ? new Date(m.fecha).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            <div className="line-clamp-1" title={m.extracto}>
                                                {/* No hay campo autores explícito, probamos extracto o N/A */}
                                                {m.autores || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <a
                                                href={`https://sutra.oslpr.org/osl/medida/${m.numero}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                                            >
                                                Ver en SUTRA ↗
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
