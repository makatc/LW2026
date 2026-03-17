'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/' },
    { label: 'Comparador', href: '/comparator' },
    { label: 'Dossier', href: '/dossier' },
    { label: 'Medidas', href: '/medidas' },
    { label: 'Legisladores', href: '/legisladores' },
    { label: 'Inteligencia', href: '/inteligencia-avanzada' },
];

export default function TopNav() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    return (
        <nav className="bg-[#2B3544] border-b border-[#363E4D] px-6 py-1.5 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-10">
                <div className="relative w-[180px] h-8">
                    <Image
                        src="/aaa.png"
                        alt="LegalWatch AI"
                        fill
                        className="object-contain object-left"
                    />
                </div>

                {/* Main Navigation */}
                <div className="flex items-center gap-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = item.href === '/'
                            ? pathname === '/'
                            : pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    px-3 py-1 rounded-lg text-xs font-semibold transition-colors
                                    ${isActive
                                        ? 'bg-[#363E4D] text-white'
                                        : 'text-gray-300 hover:text-white hover:bg-[#363E4D]/50'
                                    }
                                `}
                            >
                                {item.label}
                            </Link>
                        );
                    })}

                    {/* Admin Panel Link */}
                    {user?.role === 'admin' && (
                        <Link
                            href="/admin"
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg relative transition-colors ${pathname.startsWith('/admin') ? 'bg-red-700 text-white' : 'bg-red-600 text-white hover:bg-red-500'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                            Admin
                        </Link>
                    )}
                </div>
            </div>

            {/* Right Side: Logout */}
            <div className="flex items-center">
                <button
                    onClick={logout}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-gray-300 hover:text-white hover:bg-[#363E4D] transition-all text-xs font-semibold"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Log Out
                </button>
            </div>
        </nav>
    );
}
