'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary, fetchWatchlistItems } from '@/lib/api';

export default function SubNav() {
    const pathname = usePathname();

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
                {/* Left: Tabs */}
                <div className="flex items-center gap-1.5">
                    <Link
                        href="/"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${pathname === '/' ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                        </svg>
                        Monitor Principal
                    </Link>

                    <Link
                        href="/config"
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${pathname.startsWith('/config') || pathname.startsWith('/configuracion') ? 'text-white bg-[#2B3544]' : 'text-gray-400 hover:text-white hover:bg-[#2B3544]/50'}`}
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
