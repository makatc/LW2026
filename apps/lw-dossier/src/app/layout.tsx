import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LW Dossier — Sala de Guerra',
  description: 'Motor de Dossier Legislativo e Inteligencia de Advocacy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#F5F6FA] text-[#1e293b] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
