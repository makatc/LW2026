'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/' },
    // { label: 'Medidas', href: '/medidas' }, // Removed
    // { label: 'Configuración', href: '/config' }, // Moved to SubNav
];

export default function TopNav() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    return (

        <nav className="bg-[#2B3544] border-b border-[#363E4D] px-6 py-3 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-20">
                <div className="relative w-[250px] h-14">
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
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    px-4 py-2 rounded-lg text-sm font-medium transition-colors
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

                    {/* Admin Users Link - Moved from SubNav */}
                    {user?.role === 'admin' && (
                        <Link
                            href="/usuarios"
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg relative transition-colors ${pathname.startsWith('/usuarios') ? 'bg-red-700 text-white' : 'bg-red-600 text-white hover:bg-red-500'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                            Usuarios
                        </Link>
                    )}
                </div>
            </div>

            {/* Right Side: Logout */}
            <div className="flex items-center">
                {/* Logout Button */}
                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#363E4D] transition-all text-sm font-medium"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Log Out
                </button>
            </div>
        </nav>
    );
}
