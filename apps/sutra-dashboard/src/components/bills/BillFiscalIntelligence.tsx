'use client';

import { useEffect, useState } from 'react';
import { fetchFiscalNotesByBill, fetchFombActionsByBill } from '@/lib/api';

// ─── Color maps ───────────────────────────────────────────────────────────────

const AGENCY_COLORS: Record<string, string> = {
    OGP: 'bg-blue-100 text-blue-800',
    Hacienda: 'bg-green-100 text-green-800',
    Justicia: 'bg-purple-100 text-purple-800',
    Salud: 'bg-pink-100 text-pink-800',
};

const FOMB_STATUS_COLORS: Record<string, string> = {
    blocked: 'bg-red-100 text-red-800 border-red-200',
    under_review: 'bg-amber-100 text-amber-800 border-amber-200',
    compliant: 'bg-green-100 text-green-800 border-green-200',
    negotiating: 'bg-blue-100 text-blue-800 border-blue-200',
};

const FOMB_STATUS_LABELS: Record<string, string> = {
    blocked: 'Bloqueado',
    under_review: 'En revisión',
    compliant: 'Cumple',
    negotiating: 'Negociando',
};

const IMPACT_COLORS: Record<string, string> = {
    cost: 'bg-red-50 text-red-700',
    saving: 'bg-green-50 text-green-700',
    revenue: 'bg-blue-50 text-blue-700',
    neutral: 'bg-slate-50 text-slate-700',
    undetermined: 'bg-gray-50 text-gray-600',
};

const IMPACT_LABELS: Record<string, string> = {
    cost: 'Costo',
    saving: 'Ahorro',
    revenue: 'Ingreso',
    neutral: 'Neutral',
    undetermined: 'Por determinar',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiscalNote {
    id: string;
    title: string;
    source_agency: string;
    fiscal_impact_type: string;
    fiscal_impact_amount?: number;
    fiscal_impact_description?: string;
    summary?: string;
    bill_number?: string;
    published_at?: string;
    source_url?: string;
}

interface FombAction {
    id: string;
    law_number?: string;
    bill_number?: string;
    implementation_status: string;
    summary?: string;
    fomb_letter_url?: string;
    fomb_letter_date?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BillFiscalIntelligenceProps {
    billId: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtAmount(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
}

function fmtDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillFiscalIntelligence({ billId }: BillFiscalIntelligenceProps) {
    const [notes, setNotes] = useState<FiscalNote[]>([]);
    const [fombActions, setFombActions] = useState<FombAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!billId) return;
        setLoading(true);
        setError(null);

        Promise.all([
            fetchFiscalNotesByBill(billId).catch(() => []),
            fetchFombActionsByBill(billId).catch(() => []),
        ])
            .then(([notesData, fombData]) => {
                setNotes(Array.isArray(notesData) ? notesData : (notesData as any)?.data || []);
                setFombActions(Array.isArray(fombData) ? fombData : (fombData as any)?.data || []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [billId]);

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2].map(i => (
                    <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                Error al cargar inteligencia fiscal: {error}
            </div>
        );
    }

    const hasData = notes.length > 0 || fombActions.length > 0;

    if (!hasData) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
                <p className="font-medium text-sm">Sin datos fiscales para esta medida</p>
                <p className="text-xs mt-1">Los scrapers de OGP, Hacienda y FOMB aún no han indexado esta medida.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Memoriales Fiscales ── */}
            {notes.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">Memoriales Fiscales</h3>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                            {notes.length}
                        </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {notes.map(note => (
                            <li key={note.id} className="px-5 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${AGENCY_COLORS[note.source_agency] || 'bg-slate-100 text-slate-700'}`}>
                                                {note.source_agency}
                                            </span>
                                            {note.fiscal_impact_type && (
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${IMPACT_COLORS[note.fiscal_impact_type] || 'bg-slate-100 text-slate-600'}`}>
                                                    {IMPACT_LABELS[note.fiscal_impact_type] || note.fiscal_impact_type}
                                                </span>
                                            )}
                                            {note.fiscal_impact_amount && (
                                                <span className="text-xs font-bold text-slate-900">
                                                    {fmtAmount(note.fiscal_impact_amount)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-slate-800 leading-snug">{note.title}</p>
                                        {note.summary && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.summary}</p>
                                        )}
                                        {note.fiscal_impact_description && !note.summary && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.fiscal_impact_description}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        {note.published_at && (
                                            <span className="text-xs text-slate-400">{fmtDate(note.published_at)}</span>
                                        )}
                                        {note.source_url && (
                                            <a
                                                href={note.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-indigo-600 hover:underline font-medium"
                                            >
                                                Ver ↗
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── Acciones FOMB ── */}
            {fombActions.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">Acciones FOMB</h3>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium">
                            {fombActions.length}
                        </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {fombActions.map(action => (
                            <li key={action.id} className="px-5 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${FOMB_STATUS_COLORS[action.implementation_status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {FOMB_STATUS_LABELS[action.implementation_status] || action.implementation_status}
                                            </span>
                                            {(action.law_number || action.bill_number) && (
                                                <span className="text-xs font-bold text-slate-800">
                                                    {action.law_number || action.bill_number}
                                                </span>
                                            )}
                                        </div>
                                        {action.summary && (
                                            <p className="text-xs text-slate-600 line-clamp-2">{action.summary}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        {action.fomb_letter_date && (
                                            <span className="text-xs text-slate-400">{fmtDate(action.fomb_letter_date)}</span>
                                        )}
                                        {action.fomb_letter_url && (
                                            <a
                                                href={action.fomb_letter_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-indigo-600 hover:underline font-medium"
                                            >
                                                Carta PDF ↗
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
