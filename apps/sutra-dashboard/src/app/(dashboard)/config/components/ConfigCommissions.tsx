import { useState, useEffect } from 'react';
import { fetchFollowedCommissions, fetchAllCommissions, followCommission, unfollowCommission } from '@/lib/api';

export function ConfigCommissions() {
    const [followed, setFollowed] = useState<any[]>([]);
    const [allCommissions, setAllCommissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCommission, setSelectedCommission] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [followedData, allData] = await Promise.all([
                fetchFollowedCommissions(),
                fetchAllCommissions()
            ]);
            setFollowed(followedData);
            setAllCommissions(allData);
        } catch (error: any) {
            console.error('❌ Error loading commissions:', error);
            setMessage({ type: 'error', text: `Error: ${error?.message || 'No se pudieron cargar las comisiones'}` });
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!selectedCommission) return;
        try {
            await followCommission(selectedCommission);
            setMessage({ type: 'success', text: 'Comisión seguida' });
            setSelectedCommission(''); // Reset selection
            loadData();
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al seguir' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleUnfollow = async (id: string) => {
        if (!confirm('¿Dejar de seguir esta comisión?')) return;
        try {
            await unfollowCommission(id);
            setMessage({ type: 'success', text: 'Dejaste de seguir la comisión' });
            loadData();
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al dejar de seguir' });
        }
    };

    // Filter out commissions already followed
    const availableCommissions = allCommissions.filter(c => !followed.some(f => f.commission_id === c.id));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Comisiones Monitoreadas</h3>
                    <p className="text-sm text-slate-500">
                        Sigue comisiones enteras para recibir notificaciones de todas sus medidas.
                    </p>
                </div>
            </div>

            <div className="flex gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200 items-end">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium text-slate-700">Agregar Comisión</label>
                    <select
                        value={selectedCommission}
                        onChange={(e) => setSelectedCommission(e.target.value)}
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                        <option value="">Seleccionar comisión...</option>
                        {availableCommissions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleFollow}
                    disabled={!selectedCommission}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Seguir
                </button>
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
            ) : (
                <div className="space-y-4">
                    {followed.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                            No sigues ninguna comisión.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                            {followed.map((f) => {
                                const commName = allCommissions.find(c => c.id === f.commission_id)?.name || 'Comisión Desconocida';
                                return (
                                    <div key={f.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-200 transition-all">
                                        <span className="font-medium text-slate-800">{commName}</span>
                                        <button
                                            onClick={() => handleUnfollow(f.commission_id)}
                                            className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors"
                                        >
                                            Dejar de seguir
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
