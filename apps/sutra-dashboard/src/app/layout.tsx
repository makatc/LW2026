import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "SUTRA Monitor",
    description: "LegalWatch PR Legislative Monitor",
};

import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className={inter.className}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
