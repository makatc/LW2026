'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        console.log('🔒 ProtectedRoute state:', { isAuthenticated, isLoading });

        const timeout = setTimeout(() => {
            if (isLoading) {
                console.warn('⚠️ Auth loading hanging, forcing redirect to login');
                router.push('/login');
            }
        }, 3000);

        if (!isLoading && !isAuthenticated) {
            console.log('🚫 Not authenticated, redirecting to login');
            router.push('/login');
        }

        return () => clearTimeout(timeout);
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm w-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600 font-medium font-sans italic animate-pulse">Verificando sesión...</p>
                    <p className="text-xs text-slate-400 mt-2">Iniciando SUTRA Monitor</p>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                            ¿Tienes problemas al cargar? Ir al Login directamente
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
