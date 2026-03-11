'use client';

import { useEffect, useState } from 'react';
import { getScraperStatus, triggerScraper } from '@/lib/api';

const SCRAPERS = [
    { key: 'legislators', label: 'Legisladores', description: 'Senado + Cámara de Representantes' },
    { key: 'committees', label: 'Comités', description: 'Comisiones y membresía' },
    { key: 'bills', label: 'Medidas', description: 'Proyectos de ley desde SUTRA' },
    { key: 'votes', label: 'Votaciones', description: 'Historial de votaciones por medida' },
    { key: 'bill-text', label: 'Texto de Medidas', description: 'Extracción de PDFs legislativos' },
    { key: 'all', label: 'Todos (Pipeline Completo)', description: 'Ejecuta todos los scrapers en orden' },
];

export default function ScraperAdminPage() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 15000);
        return () => clearInterval(interval);
    }, []);

    async function loadStatus() {
        try {
            const data = await getScraperStatus();
            setStatus(data);
        } catch (e: any) {
            // Queue may not be available if Redis is down
        } finally {
            setLoading(false);
        }
    }

    async function handleTrigger(scraperKey: string) {
        setTriggering(scraperKey);
        setMessage(null);
        try {
            const result = await triggerScraper(scraperKey);
            setMessage({ type: 'success', text: `✓ ${scraperKey} encolado correctamente` });
            setTimeout(loadStatus, 2000);
        } catch (e: any) {
            setMessage({ type: 'error', text: `Error: ${e.message}` });
        } finally {
            setTriggering(null);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin — Scrapers</h1>
                <p className="text-slate-500 text-sm mt-1">Gestión manual de los scrapers legislativos</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg border text-sm ${
                    message.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Scraper buttons */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Ejecutar Scrapers</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SCRAPERS.map(scraper => (
                        <div key={scraper.key} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800">{scraper.label}</p>
                                    <p className="text-xs text-slate-500 mt-1">{scraper.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleTrigger(scraper.key)}
                                disabled={triggering !== null}
                                className="mt-3 w-full py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {triggering === scraper.key ? 'Encolando...' : 'Ejecutar'}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Queue Status */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Estado de Colas (BullMQ)</h2>
                {loading ? (
                    <p className="text-slate-400 text-sm">Cargando estado...</p>
                ) : !status?.queues ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                        Redis no disponible. Los scrapers correrán via cron automáticamente.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(status.queues).map(([queueName, counts]: [string, any]) => (
                            <div key={queueName} className="bg-white border border-slate-200 rounded-lg p-3">
                                <p className="text-xs font-mono text-slate-500 mb-2">{queueName}</p>
                                {counts.error ? (
                                    <p className="text-xs text-red-500">{counts.error}</p>
                                ) : (
                                    <div className="flex gap-3 text-xs">
                                        <span className="text-blue-600">
                                            <span className="font-bold">{counts.active || 0}</span> activos
                                        </span>
                                        <span className="text-amber-600">
                                            <span className="font-bold">{counts.waiting || 0}</span> esperando
                                        </span>
                                        <span className="text-green-600">
                                            <span className="font-bold">{counts.completed || 0}</span> completados
                                        </span>
                                        <span className="text-red-600">
                                            <span className="font-bold">{counts.failed || 0}</span> fallidos
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Recent Runs */}
            {status?.recent_runs?.length > 0 && (
                <section>
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Runs Recientes</h2>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Scraper</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Nuevos</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actualizados</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Inicio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {status.recent_runs.map((run: any) => (
                                    <tr key={run.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{run.scraper_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                run.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                                                run.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {run.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-600">{run.records_new}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{run.records_updated}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {run.started_at ? new Date(run.started_at).toLocaleString('es-PR') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
