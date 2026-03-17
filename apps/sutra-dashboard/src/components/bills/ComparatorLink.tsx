'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';

interface ComparatorLinkProps {
    billId: string;
    billNumber: string;
    billTitle?: string;
    hasVersions: boolean;
}

export default function ComparatorLink({ billId, billNumber, billTitle, hasVersions }: ComparatorLinkProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    const comparatorUrl = `http://localhost:3002/comparator?prefill_bill_id=${encodeURIComponent(billId)}&prefill_bill_number=${encodeURIComponent(billNumber)}`;

    if (!hasVersions) {
        return (
            <div className="relative inline-block">
                <button
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-400 bg-slate-50 cursor-not-allowed"
                    disabled
                    aria-label="Comparar versiones — requiere versiones cargadas"
                >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Comparar
                </button>
                {showTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
                        El comparador requiere al menos una versión cargada
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <a
            href={comparatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-indigo-300 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-colors font-medium"
            title={billTitle ? `Comparar versiones de ${billTitle}` : 'Abrir en Comparador'}
        >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Comparar
        </a>
    );
}
