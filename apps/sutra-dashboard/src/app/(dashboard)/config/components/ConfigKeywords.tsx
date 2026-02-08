import { useState, useEffect } from 'react';
import { fetchConfigKeywords, addKeyword, deleteKeyword } from '@/lib/api';

export function ConfigKeywords() {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchConfigKeywords();
            setKeywords(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim()) return;

        try {
            await addKeyword(newKeyword);
            setNewKeyword('');
            setMessage({ type: 'success', text: 'Palabra clave agregada' });
            loadData(); // Reload list
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al agregar' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta palabra clave?')) return;
        try {
            await deleteKeyword(id);
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
                    <h3 className="text-lg font-medium text-slate-900">Palabras Clave (Keywords)</h3>
                    <p className="text-sm text-slate-500">
                        Recibe alertas cuando estas palabras aparezcan en el título o cuerpo de una medida.
                    </p>
                </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleAdd} className="flex gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Ej. 'Inteligencia Artificial', 'Energía Solar'..."
                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-primary focus:ring-primary"
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm"
                    disabled={!newKeyword.trim()}
                >
                    Agregar +
                </button>
            </form>

            {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {/* List */}
            {/* List */}
            {loading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
            ) : keywords.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    No hay palabras clave configuradas.
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {keywords.map((k) => (
                        <div key={k.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium border border-transparent hover:border-slate-300 hover:bg-slate-200 transition-all group">
                            <span>{k.keyword}</span>
                            <button
                                onClick={() => handleDelete(k.id)}
                                className="w-4 h-4 rounded-full bg-slate-300 text-slate-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                title="Eliminar"
                            >
                                <span className="text-xs font-bold leading-none mb-0.5">×</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
