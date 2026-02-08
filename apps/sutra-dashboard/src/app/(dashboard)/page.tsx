'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchDashboardSummary,
    fetchFindings,
    fetchWatchlistItems,
    fetchCommissionNotifications,
    addMeasureToWatchlist
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import ChartCard from '@/components/ChartCard';

export default function DashboardPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['summary'],
        queryFn: fetchDashboardSummary
    });

    const { data: watchlistData, isLoading: loadingWatchlist } = useQuery({
        queryKey: ['dashboard', 'watchlist'],
        queryFn: () => fetchWatchlistItems({ limit: 10 })
    });

    const { data: findingsData, isLoading: loadingFindings } = useQuery({
        queryKey: ['dashboard', 'findings'],
        queryFn: () => fetchFindings({ limit: 10 })
    });

    const { data: commissionsData, isLoading: loadingCommissions } = useQuery({
        queryKey: ['dashboard', 'commissions'],
        queryFn: () => fetchCommissionNotifications({ limit: 10 })
    });

    const addToWatchlistMutation = useMutation({
        mutationFn: (measureId: string) => addMeasureToWatchlist(measureId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'watchlist'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            setSuccessMessage('✓ Agregado a Watchlist');
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (error: any) => {
            alert(`Error: ${error.message || 'No se pudo agregar a Watchlist'}`);
        }
    });

    const isLoading = loadingSummary || loadingWatchlist || loadingFindings || loadingCommissions;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Cargando tablero...</p>
                </div>
            </div>
        );
    }

    const watchlistItems = watchlistData?.data || [];
    const findings = findingsData?.data || [];
    const commissionNotifs = commissionsData?.data || [];

    return (
        <div className="space-y-6">
            {/* Success Message */}
            {successMessage && (
                <div className="fixed top-20 right-6 z-50 bg-success text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-4 fade-in">
                    {successMessage}
                </div>
            )}

            {/* Main Grid: Asymmetric Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column (2/3): Hallazgos - Large */}
                <div className="lg:col-span-2">
                    <ChartCard
                        title="Hallazgos Recientes"
                        subtitle={`${findings.length} coincidencias encontradas`}
                    >
                        <div className="space-y-3 h-[680px] overflow-y-auto">
                            {findings.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-40">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                    </svg>
                                    <p className="text-sm font-medium">No hay hallazgos recientes</p>
                                    <p className="text-xs mt-1">Configura keywords y temas para comenzar</p>
                                </div>
                            ) : (
                                findings.map((finding: any) => (
                                    <div key={finding.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition-all">
                                        <div className="flex justify-between items-start mb-2.5">
                                            <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg font-semibold">
                                                {finding.type === 'keyword' ? 'Keyword' : 'Tema'}
                                            </span>
                                            <button
                                                onClick={() => addToWatchlistMutation.mutate(finding.measureId)}
                                                disabled={addToWatchlistMutation.isPending}
                                                className="text-xs px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-50 shadow-sm"
                                            >
                                                {addToWatchlistMutation.isPending ? '...' : '+ Watchlist'}
                                            </button>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-2 line-clamp-2">
                                            {finding.measure?.numero}: {finding.measure?.titulo || 'Sin título'}
                                        </p>
                                        <p className="text-xs text-slate-600">
                                            Coincidencia: <span className="font-semibold text-primary">"{finding.matchedText || finding.keyword}"</span>
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </ChartCard>
                </div>

                {/* Right Column (1/3): Watchlist - Sidebar */}
                <div className="lg:col-span-1">
                    <ChartCard
                        title="Watchlist"
                        className="!bg-blue-50 !border-blue-200"
                    >
                        <div className="space-y-2 h-[680px] overflow-y-auto">
                            {watchlistItems.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-3 opacity-40">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                                    </svg>
                                    <p className="text-xs font-medium">Watchlist vacía</p>
                                    <p className="text-xs mt-1 text-slate-400">Agrega medidas para rastrear</p>
                                </div>
                            ) : (
                                watchlistItems.map((item: any) => (
                                    <div key={item.id} className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-100 transition-all">
                                        <p className="text-xs font-semibold text-slate-900 line-clamp-2 mb-1.5">
                                            {item.numero || item.measureId}
                                        </p>
                                        <p className="text-xs text-slate-600 line-clamp-2">
                                            {item.titulo || 'Sin título'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </ChartCard>
                </div>

                {/* Bottom Row: Comisiones (Smaller/Compact) */}
                <div className="lg:col-span-3">
                    <ChartCard
                        title="Notificaciones de Comisiones"
                        subtitle={`${commissionNotifs.length} actualizaciones`}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {commissionNotifs.length === 0 ? (
                                <div className="col-span-full text-center py-6 text-slate-400">
                                    <p className="text-sm">No hay notificaciones de comisiones</p>
                                </div>
                            ) : (
                                commissionNotifs.slice(0, 8).map((notif: any) => (
                                    <div key={notif.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-accent/30 transition-all">
                                        <div className="flex items-start justify-between mb-1.5">
                                            <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded font-semibold">
                                                Comisión
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {new Date(notif.createdAt).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-900 mb-1 line-clamp-2">
                                            {notif.commissionName}
                                        </p>
                                        <p className="text-xs text-slate-600 line-clamp-2">
                                            {notif.details || 'Nueva actualización disponible'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </ChartCard>
                </div>
            </div>
        </div>
    );
}
