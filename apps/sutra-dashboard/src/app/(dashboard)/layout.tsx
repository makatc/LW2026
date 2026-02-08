'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import TopNav from '@/components/TopNav';
import SubNav from '@/components/SubNav';
import Footer from '@/components/Footer';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <div className="flex flex-col min-h-screen bg-[#F5F6FA]">
                <TopNav />
                <SubNav />
                <main className="flex-1 p-6">
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </main>
                <Footer />
            </div>
        </ProtectedRoute>
    );
}
