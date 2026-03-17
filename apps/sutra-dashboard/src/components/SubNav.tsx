'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary, fetchWatchlistItems } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function SubNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    const { data: summary } = useQuery({
        queryKey: ['summary'],
        queryFn: fetchDashboardSummary
    });

    const { data: watchlistData } = useQuery({
        queryKey: ['dashboard', 'watchlist'],
        queryFn: () => fetchWatchlistItems({ limit: 10 })
    });

    const watchlistItems = watchlistData?.data || [];

    return (
        <div className="bg-[#363E4D] border-b border-[#424B5C] px-6 py-1.5">
            <div className="flex items-center justify-between">
                {/* Left: Tab */}
                <div className="flex items-center gap-1.5">
                    <Link
                        href="/"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg relative transition-colors ${pathname === '/' ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                        </svg>
                        Monitor Principal
                    </Link>

                    <Link
                        href="/medidas"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg relative transition-colors ${pathname.startsWith('/medidas') ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        Medidas
                    </Link>

                    <Link
                        href="/legisladores"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg relative transition-colors ${pathname.startsWith('/legisladores') ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                        </svg>
                        Legisladores
                    </Link>

                    <Link
                        href="/inteligencia-fiscal"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg relative transition-colors ${pathname.startsWith('/inteligencia-fiscal') ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                        </svg>
                        Inteligencia Fiscal
                    </Link>

                    <Link
                        href="/config"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg relative transition-colors ${pathname.startsWith('/config') ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.581-.495.644-.869l.214-1.281Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                        Configuración
                    </Link>



                </div>

                {/* Right: Inline Metrics */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-white">{summary?.hits_keyword || 0}</div>
                        <div className="text-xs text-gray-400">Keywords Detectados</div>
                    </div>
                    <div className="h-5 w-px bg-[#424B5C]" />
                    <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-white">{summary?.hits_topics || 0}</div>
                        <div className="text-xs text-gray-400">Temas Identificados</div>
                    </div>
                    <div className="h-5 w-px bg-[#424B5C]" />
                    <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-white">{summary?.hits_commissions || 0}</div>
                        <div className="text-xs text-gray-400">Comisiones</div>
                    </div>
                    <div className="h-5 w-px bg-[#424B5C]" />
                    <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-white">{watchlistItems.length}</div>
                        <div className="text-xs text-gray-400">En Watchlist</div>
                    </div>
                </div>
            </div>
        </div>

    );
}
