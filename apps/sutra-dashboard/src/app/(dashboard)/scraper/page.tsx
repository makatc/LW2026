'use client';

import { useEffect, useState } from 'react';
import { getScraperStatus, triggerScraper, getScraperConfigs, updateScraperConfig } from '@/lib/api';
import { ScraperCard } from './SchedulerEditor';

const SCRAPERS = [
    { key: 'legislators', label: 'Legisladores', description: 'Senado + Cámara de Representantes' },
    { key: 'committees', label: 'Comités', description: 'Comisiones y membresía' },
    { key: 'bills', label: 'Medidas', description: 'Proyectos de ley desde SUTRA' },
    { key: 'votes', label: 'Votaciones', description: 'Historial de votaciones por medida' },
    { key: 'bill-text', label: 'Texto de Medidas', description: 'Extracción de PDFs legislativos' },
];

export default function ScraperAdminPage() {
    const [status, setStatus] = useState<any>(null);
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    async function loadData() {
        await Promise.all([loadStatus(), loadConfigs()]);
        setLoading(false);
    }

    async function loadConfigs() {
        try {
            const data = await getScraperConfigs();
            setConfigs(data);
        } catch (e) {
            // Configs unavailable
        }
    }

    async function loadStatus() {
        try {
            const data = await getScraperStatus();
            setStatus(data);
        } catch (e) {
            // Queue may not be available if Redis is down
        }
    }

    async function handleTrigger(scraperKey: string) {
        setTriggering(scraperKey);
        setMessage(null);
        try {
            await triggerScraper(scraperKey);
            setMessage({ type: 'success', text: `✓ ${scraperKey} encolado correctamente` });
            setTimeout(loadData, 3000);
        } catch (e: any) {
            setMessage({ type: 'error', text: `Error: ${e.message}` });
        } finally {
            setTriggering(null);
        }
    }

    async function handleSaveConfig(id: string, is_enabled: boolean, cron_expression: string) {
        try {
            await updateScraperConfig(id, is_enabled, cron_expression);
            setMessage({ type: 'success', text: `✓ Configuración de "${id}" guardada` });
            loadConfigs();
            setTimeout(() => setMessage(null), 4000);
        } catch (e: any) {
            setMessage({ type: 'error', text: `Error: ${e.message}` });
            setTimeout(() => setMessage(null), 5000);
        }
    }

    // Build a map of last runs from status.recent_runs
    const lastRunMap: Record<string, string | null> = {};
    if (status?.recent_runs) {
        for (const run of status.recent_runs) {
            if (!lastRunMap[run.scraper_name] && run.status === 'SUCCESS') {
                lastRunMap[run.scraper_name] = run.started_at;
            }
        }
    }
    // Also use last_run_at from scraper_configs if available
    for (const conf of configs) {
        if (conf.last_run_at && !lastRunMap[conf.id]) {
            lastRunMap[conf.id] = conf.last_run_at;
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin — Scrapers</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Controla cuándo y con qué frecuencia se actualizan los datos legislativos.
                    Los scrapers están <strong>pausados</strong> por defecto al iniciar el servidor.
                </p>
            </div>

            {message && (
                <div className={`p-3 rounded-lg border text-sm ${
                    message.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Scraper Cards */}
            <section>
                <h2 className="text-base font-semibold text-slate-700 mb-4">Scrapers Individuales</h2>
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SCRAPERS.map(s => (
                            <div key={s.key} className="bg-white border border-slate-200 rounded-xl p-4 h-48 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SCRAPERS.map(s => {
                            const conf = configs.find(c => c.id === s.key);
                            return (
                                <ScraperCard
                                    key={s.key}
                                    id={s.key}
                                    label={s.label}
                                    currentCron={conf?.cron_expression ?? '0 6 * * *'}
                                    isEnabled={conf?.is_enabled ?? false}
                                    lastRunAt={lastRunMap[s.key] ?? conf?.last_run_at ?? null}
                                    onSave={handleSaveConfig}
                                    onTrigger={handleTrigger}
                                    isTriggering={triggering === s.key}
                                />
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Run all */}
            <section>
                <button
                    onClick={() => handleTrigger('all')}
                    disabled={triggering !== null}
                    className="w-full py-3 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {triggering === 'all' ? 'Ejecutando todos...' : 'Ejecutar Todos los Scrapers Ahora'}
                </button>
            </section>

            {/* Queue Status */}
            {status?.queues && (
                <section>
                    <h2 className="text-base font-semibold text-slate-700 mb-3">Estado de Colas</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Object.entries(status.queues).map(([queueName, counts]: [string, any]) => (
                            <div key={queueName} className="bg-white border border-slate-200 rounded-lg p-3">
                                <p className="text-[10px] font-mono text-slate-500 mb-2 truncate">{queueName}</p>
                                {counts.error ? (
                                    <p className="text-xs text-amber-500">Redis no disponible</p>
                                ) : (
                                    <div className="space-y-0.5 text-xs">
                                        <div className="flex justify-between"><span className="text-slate-400">Activos</span><span className="font-semibold text-blue-600">{counts.active ?? 0}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Esperando</span><span className="font-semibold text-amber-600">{counts.waiting ?? 0}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Completados</span><span className="font-semibold text-green-600">{counts.completed ?? 0}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Fallidos</span><span className="font-semibold text-red-600">{counts.failed ?? 0}</span></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Recent Runs */}
            {status?.recent_runs?.length > 0 && (
                <section>
                    <h2 className="text-base font-semibold text-slate-700 mb-3">Ejecuciones Recientes</h2>
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
                                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{run.scraper_name}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                run.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                                                run.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {run.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 text-xs">{run.records_new}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 text-xs">{run.records_updated}</td>
                                        <td className="px-4 py-2.5 text-xs text-slate-400">
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
