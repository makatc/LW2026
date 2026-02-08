'use client';

import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { ConfigKeywords } from './components/ConfigKeywords';
import { ConfigTopics } from './components/ConfigTopics';
import { ConfigCommissions } from './components/ConfigCommissions';
import { ConfigWatchlist } from './components/ConfigWatchlist';
import { ConfigWebhooks } from './components/ConfigWebhooks';

const MENU_TABS = [
    { id: 'keywords', label: 'Palabras Clave', icon: '🔍' },
    { id: 'topics', label: 'Temas y Frases', icon: '💭' },
    { id: 'commissions', label: 'Comisiones', icon: '🏛️' },
    { id: 'watchlist', label: 'Medidas (Watchlist)', icon: '📜' },
    { id: 'webhooks', label: 'Notificaciones', icon: '🔔' },
];

export default function ConfigPage() {
    const [activeTab, setActiveTab] = useState('keywords');

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Onboarding / Info Box */}
            <div className="bg-gradient-to-r from-blue-50 to-white border border-blue-100 p-6 rounded-[1.5rem] flex items-start gap-4 shadow-sm">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600 mt-1">
                    <span className="text-xl">💡</span>
                </div>
                <div>
                    <h3 className="font-bold text-blue-900 text-lg">Personaliza tu Monitoreo</h3>
                    <p className="text-blue-700/80 mt-1 text-sm leading-relaxed">
                        Aquí defines qué es importante para ti. Agrega <strong>Palabras Clave</strong> para recibir alertas inmediatas,
                        sigue <strong>Medidas Específicas</strong> para rastrear su trámite, y configura tus <strong>Notificaciones</strong>
                        para recibir todo en Discord o Telegram.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-8 min-h-[600px]">
                <Tabs
                    tabs={MENU_TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />

                <div className="mt-8">
                    {activeTab === 'keywords' && <ConfigKeywords />}
                    {activeTab === 'topics' && <ConfigTopics />}
                    {activeTab === 'commissions' && <ConfigCommissions />}
                    {activeTab === 'watchlist' && <ConfigWatchlist />}
                    {activeTab === 'webhooks' && <ConfigWebhooks />}
                </div>
            </div>
        </div>
    );
}
