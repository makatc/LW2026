'use client';

import { useState } from 'react';

export default function ComparatorPage() {
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    // This URL points to the backend API (port 3002)
    // In a real app, this should be proxied or configured in env
    const COMPARATOR_API = 'http://localhost:3002';

    const handleCompare = async () => {
        setLoading(true);
        try {
            // For now, we'll simulate a comparison call or use a direct endpoint if available
            // Since the API expects version IDs, we might need a different UI flow 
            // where we first "ingest" the text to get IDs.
            // But let's start with a placeholder message as per user request to "access" the app.

            // TODO: Implement actual API call flow:
            // 1. Ingest Source -> Get Version ID
            // 2. Ingest Target -> Get Version ID
            // 3. Compare Context -> Get Result

            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulacion
            setResult({ message: 'Comparison feature coming soon! This is a placeholder UI.' });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Comparador de Leyes</h1>
                    <p className="text-gray-500">Compara versiones de documentos legislativos.</p>
                </div>
            </header>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Versión Original</label>
                        <textarea
                            className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Pega el texto original aquí..."
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nueva Versión</label>
                        <textarea
                            className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Pega el texto nuevo aquí..."
                            value={targetText}
                            onChange={(e) => setTargetText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleCompare}
                        disabled={loading || !sourceText || !targetText}
                        className={`
                            px-6 py-2 rounded-lg text-white font-medium
                            ${loading || !sourceText || !targetText
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }
                        `}
                    >
                        {loading ? 'Procesando...' : 'Comparar Documentos'}
                    </button>
                </div>

                {result && (
                    <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h3 className="text-lg font-medium text-yellow-800">Resultado</h3>
                        <p className="text-yellow-700">{result.message}</p>
                        <p className="text-sm text-yellow-600 mt-2">
                            API Endpoint: <strong>{COMPARATOR_API}</strong>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
