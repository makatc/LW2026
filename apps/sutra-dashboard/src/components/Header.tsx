'use client';

import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();

    // Map path to readable title
    const getPageTitle = (path: string) => {
        if (path === '/') return 'Dashboard';
        if (path === '/medidas') return 'Medidas Legislativas';
        if (path === '/alertas') return 'Alertas Recientes';
        if (path === '/config') return 'Configuración';
        if (path === '/usuarios') return 'Gestión de Usuarios';
        if (path.startsWith('/medidas/')) return 'Detalle de Medida';
        return 'SUTRA Monitor';
    };

    return (
        <header className="h-20 mb-8 flex items-center justify-between sticky top-0 z-10 bg-[#f0f4f8]/80 backdrop-blur-md -mx-8 px-8 border-b border-indigo-100/50">
            <div>
                <nav className="flex text-sm text-slate-500 mb-1">
                    <span>Admin</span>
                    <span className="mx-2">/</span>
                    <span className="text-indigo-600 font-medium">{pathname === '/' ? 'Home' : pathname.split('/')[1]}</span>
                </nav>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                    {getPageTitle(pathname)}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 shadow-sm transition-all"
                    />
                </div>

                <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50 relative">
                    🔔
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>
            </div>
        </header>
    );
}
