'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('🔴 App Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Algo salió mal</h2>
                <p className="text-slate-600 mb-6">
                    {error.message || 'Ha ocurrido un error inesperado en la aplicación.'}
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => reset()}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        Ir al inicio
                    </button>
                </div>
                {error.digest && (
                    <p className="mt-4 text-[10px] text-slate-400 font-mono">
                        ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
