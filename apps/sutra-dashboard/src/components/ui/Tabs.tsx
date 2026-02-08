import React from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
    return (
        <div className="flex space-x-1 rounded-xl bg-slate-100 p-1 mb-6 overflow-x-auto">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`
                            w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                            flex items-center justify-center gap-2 transition-all duration-200
                            ${isActive
                                ? 'bg-white text-indigo-700 shadow shadow-indigo-500/10'
                                : 'text-slate-500 hover:bg-white/[0.12] hover:text-slate-900'
                            }
                        `}
                    >
                        {tab.icon && <span className="text-lg">{tab.icon}</span>}
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
