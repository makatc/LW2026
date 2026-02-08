import { useState, useEffect } from 'react';
import { fetchWatchlist, addToWatchlistByNumber, removeFromWatchlist } from '@/lib/api';

export function ConfigWatchlist() {
    const [watchlist, setWatchlist] = useState<any[]>([]);
    const [newNumber, setNewNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchWatchlist();
            setWatchlist(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNumber.trim()) return;

        try {
            const res = await addToWatchlistByNumber(newNumber);
            setNewNumber('');
            if (res.pending) {
                setMessage({ type: 'success', text: 'Agregada como pendiente (se buscará pronto)' });
            } else {
                setMessage({ type: 'success', text: 'Medida agregada al Watchlist' });
            }
            loadData();
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al agregar medida' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm('¿Dejar de rastrear esta medida?')) return;
        try {
            await removeFromWatchlist(id);
            setMessage({ type: 'success', text: 'Eliminada correctamente' });
            loadData();
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al eliminar' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Watchlist (Seguimiento Específico)</h3>
                    <p className="text-sm text-slate-500">
                        Rastrea medidas específicas por su número (ej. "PC1024", "P. de la C. 543").
                    </p>
                </div>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input
                    type="text"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    placeholder="Número de medida (ej. 1234)"
                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                    disabled={!newNumber.trim()}
                >
                    Rastrear +
                </button>
            </form>

            {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
            ) : watchlist.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    No hay medidas en seguimiento.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                    {watchlist.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-200 transition-all">
                            <div>
                                <span className="font-bold text-indigo-900 block">
                                    {item.measure_number || (item.measure ? item.measure.numero : 'Desconocido')}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {item.measure_id ? 'Encontrada y rastreando' : 'Pendiente de búsqueda'}
                                </span>
                            </div>
                            <button
                                onClick={() => handleRemove(item.id)}
                                className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors"
                            >
                                Dejar de rastrear
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
