import { useState, useEffect } from 'react';
import { fetchPhrases, addPhrase, deletePhrase } from '@/lib/api';

export function ConfigTopics() {
    const [phrases, setPhrases] = useState<any[]>([]);
    const [newPhrase, setNewPhrase] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchPhrases();
            setPhrases(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPhrase.trim()) return;

        try {
            await addPhrase(newPhrase);
            setNewPhrase('');
            setMessage({ type: 'success', text: 'Tema agregado' });
            loadData();
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al agregar' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este tema?')) return;
        try {
            await deletePhrase(id);
            setMessage({ type: 'success', text: 'Eliminado correctamente' });
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
                    <h3 className="text-lg font-medium text-slate-900">Temas y Frases (Topics)</h3>
                    <p className="text-sm text-slate-500">
                        Monitorea frases exactas o temas complejos ("Cambio Climático", "Reforma Contributiva").
                    </p>
                </div>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input
                    type="text"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    placeholder="Ej. 'Ley de Armas', 'Permisos de Construcción'..."
                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                    disabled={!newPhrase.trim()}
                >
                    Agregar +
                </button>
            </form>

            {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
            ) : phrases.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    No hay temas configurados.
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {phrases.map((p) => (
                        <div key={p.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-transparent hover:border-blue-200 hover:bg-blue-100 transition-all group">
                            <span>{p.phrase}</span>
                            <button
                                onClick={() => handleDelete(p.id)}
                                className="w-4 h-4 rounded-full bg-blue-200 text-blue-500 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
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
