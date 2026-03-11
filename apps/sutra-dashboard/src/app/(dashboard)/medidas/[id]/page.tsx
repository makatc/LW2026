'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchBillDetail } from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';

const COMPARATOR_PATH = '/comparator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillVersion {
    id: string;
    version_note: string;
    pdf_url: string | null;
    is_current: boolean;
    created_at: string;
}

interface BillVote {
    id: string;
    vote_date: string | null;
    motion_text: string;
    result: 'pass' | 'fail' | null;
    yea_count: number;
    nay_count: number;
    abstain_count: number;
    chamber: 'upper' | 'lower';
}

interface BillAction {
    date?: string;
    type?: string;
    description: string;
}

interface Bill {
    id: string;
    numero: string;
    titulo: string;
    extracto: string;
    fecha: string | null;
    source_url: string;
    bill_type: string;
    status: string | null;
    author: string | null;
    author_names: string[] | null;
    actions: BillAction[];
    commission_name: string | null;
    last_seen_at: string | null;
    updated_at: string;
    versions: BillVersion[];
    votes: BillVote[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BILL_TYPE_LABELS: Record<string, string> = {
    bill: 'Proyecto de Ley',
    resolution: 'Resolución',
    other: 'Otra Medida',
};

const BILL_TYPE_COLORS: Record<string, string> = {
    bill: 'bg-blue-100 text-blue-800',
    resolution: 'bg-purple-100 text-purple-800',
    other: 'bg-slate-100 text-slate-700',
};

const CHAMBER_LABELS: Record<string, string> = {
    upper: 'Senado',
    lower: 'Cámara',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [bill, setBill] = useState<Bill | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('info');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetchBillDetail(id)
            .then(data => {
                if (!data) { setError('Medida no encontrada.'); return; }
                // Normalize: actions may be stored as JSON string in some older records
                const actions = typeof data.actions === 'string'
                    ? JSON.parse(data.actions)
                    : (data.actions ?? []);
                setBill({ ...data, actions });
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                <p className="ml-3 text-slate-500">Cargando medida...</p>
            </div>
        );
    }

    if (error || !bill) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 font-medium">{error || 'Medida no encontrada.'}</p>
                <button
                    onClick={() => router.back()}
                    className="mt-3 text-sm text-indigo-600 hover:underline"
                >
                    ← Volver
                </button>
            </div>
        );
    }

    const typeLabel = BILL_TYPE_LABELS[bill.bill_type] || bill.bill_type;
    const typeColor = BILL_TYPE_COLORS[bill.bill_type] || BILL_TYPE_COLORS.other;
    const currentVersion = bill.versions.find(v => v.is_current);
    const tabs = [
        { id: 'info', label: 'Información' },
        { id: 'historial', label: `Historial (${bill.actions?.length ?? 0})` },
        { id: 'versiones', label: `Versiones (${bill.versions?.length ?? 0})` },
        ...(bill.votes?.length > 0 ? [{ id: 'votaciones', label: `Votaciones (${bill.votes.length})` }] : []),
    ];

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-slate-400">
                <Link href="/medidas" className="hover:text-indigo-600 transition-colors">
                    Medidas
                </Link>
                <span>/</span>
                <span className="text-slate-700 font-medium">{bill.numero}</span>
            </nav>

            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeColor}`}>
                                {typeLabel}
                            </span>
                            <span className="text-2xl font-bold text-slate-900">{bill.numero}</span>
                            {bill.status && <StatusBadge status={bill.status} />}
                        </div>
                        <h1 className="text-lg font-semibold text-slate-800 leading-snug mt-2">
                            {bill.titulo}
                        </h1>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <a
                            href={bill.source_url || `https://sutra.oslpr.org/osl/medida/${bill.numero}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Ver en SUTRA ↗
                        </a>
                        {currentVersion?.pdf_url && (
                            <a
                                href={currentVersion.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                PDF ↓
                            </a>
                        )}
                    </div>
                </div>

                {/* Metadata row */}
                <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                    <MetaItem label="Comisión" value={bill.commission_name} />
                    <MetaItem label="Autor" value={bill.author || bill.author_names?.join(', ')} />
                    <MetaItem
                        label="Radicación"
                        value={bill.fecha ? fmtDate(bill.fecha) : null}
                    />
                    <MetaItem
                        label="Última actualización"
                        value={bill.last_seen_at ? fmtDate(bill.last_seen_at) : fmtDate(bill.updated_at)}
                    />
                </dl>
            </div>

            {/* Tabs */}
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            {/* Tab content */}
            {activeTab === 'info' && (
                <InfoTab bill={bill} />
            )}
            {activeTab === 'historial' && (
                <HistorialTab actions={bill.actions} />
            )}
            {activeTab === 'versiones' && (
                <VersionesTab versions={bill.versions} billNumero={bill.numero} />
            )}
            {activeTab === 'votaciones' && (
                <VotacionesTab votes={bill.votes} />
            )}
        </div>
    );
}

// ─── Tab: Info ────────────────────────────────────────────────────────────────

function InfoTab({ bill }: { bill: Bill }) {
    return (
        <div className="space-y-4">
            {bill.extracto ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Extracto
                    </h2>
                    <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-line">
                        {bill.extracto.length > 2000
                            ? bill.extracto.slice(0, 2000) + '…'
                            : bill.extracto}
                    </p>
                </div>
            ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center text-slate-400">
                    <p>No hay extracto disponible para esta medida.</p>
                    <p className="text-xs mt-1">El extracto se genera al procesar el PDF de la medida.</p>
                </div>
            )}

            {bill.author_names && bill.author_names.length > 1 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Autores
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {bill.author_names.map((name, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tab: Historial ───────────────────────────────────────────────────────────

function HistorialTab({ actions }: { actions: BillAction[] }) {
    if (!actions || actions.length === 0) {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <p>No hay historial de acciones disponible.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {actions.map((action, i) => (
                    <li key={i} className="px-6 py-4 flex gap-4">
                        <div className="shrink-0 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 leading-snug">{action.description}</p>
                            {action.date && (
                                <p className="text-xs text-slate-400 mt-1">{action.date}</p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Tab: Versiones ───────────────────────────────────────────────────────────

function VersionesTab({ versions, billNumero }: { versions: BillVersion[]; billNumero: string }) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());

    if (!versions || versions.length === 0) {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <p>No hay versiones de texto disponibles.</p>
                <p className="text-xs mt-1">El scraper de textos procesa el PDF y almacena versiones aquí.</p>
            </div>
        );
    }

    const sorted = [...versions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const withPdf = sorted.filter(v => v.pdf_url);
    const canCompare = withPdf.length >= 2;

    function toggleSelect(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else if (next.size < 2) {
                next.add(id);
            }
            return next;
        });
    }

    function openComparator() {
        const sel = sorted.filter(v => selected.has(v.id));
        if (sel.length !== 2) return;
        // Older version = source (base), newer = target (proposed)
        const [newer, older] = sel.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const params = new URLSearchParams({
            source_pdf: older.pdf_url!,
            source_label: `${billNumero} — ${older.version_note}`,
            target_pdf: newer.pdf_url!,
            target_label: `${billNumero} — ${newer.version_note}`,
        });
        router.push(`${COMPARATOR_PATH}?${params.toString()}`);
    }

    // Auto-select the two most recent PDF versions when there are exactly 2
    const autoSelected = selected.size === 0 && withPdf.length === 2;
    const effectiveSelected = autoSelected ? new Set(withPdf.map(v => v.id)) : selected;
    const readyToCompare = effectiveSelected.size === 2 &&
        Array.from(effectiveSelected).every(id => sorted.find(v => v.id === id)?.pdf_url);

    return (
        <div className="space-y-3">
            {/* Comparison banner */}
            {canCompare && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-indigo-800">
                            {selected.size === 0
                                ? `${withPdf.length} versiones con PDF disponibles`
                                : selected.size === 1
                                ? 'Selecciona una segunda versión para comparar'
                                : '2 versiones seleccionadas — listas para comparar'}
                        </p>
                        <p className="text-xs text-indigo-600 mt-0.5">
                            {withPdf.length === 2
                                ? 'Las dos versiones se compararán automáticamente'
                                : 'Marca las casillas de dos versiones'}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (autoSelected) {
                                // Use the two auto-selected ones
                                const params = new URLSearchParams({
                                    source_pdf: withPdf[1].pdf_url!,
                                    source_label: `${billNumero} — ${withPdf[1].version_note}`,
                                    target_pdf: withPdf[0].pdf_url!,
                                    target_label: `${billNumero} — ${withPdf[0].version_note}`,
                                });
                                router.push(`${COMPARATOR_PATH}?${params.toString()}`);
                            } else {
                                openComparator();
                            }
                        }}
                        disabled={!readyToCompare && !autoSelected}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Comparar versiones →
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            {canCompare && <th className="px-4 py-3 w-10"></th>}
                            <th className="px-5 py-3 text-left font-semibold text-slate-700">Nota</th>
                            <th className="px-5 py-3 text-left font-semibold text-slate-700">Fecha</th>
                            <th className="px-5 py-3 text-left font-semibold text-slate-700">Estado</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sorted.map(v => {
                            const isSelected = effectiveSelected.has(v.id);
                            const isDisabled = canCompare && !v.pdf_url;
                            return (
                                <tr
                                    key={v.id}
                                    className={`transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                >
                                    {canCompare && (
                                        <td className="px-4 py-3 text-center">
                                            {v.pdf_url ? (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(v.id)}
                                                    disabled={!isSelected && effectiveSelected.size >= 2}
                                                    className="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                                />
                                            ) : (
                                                <span className="text-slate-300 text-xs">—</span>
                                            )}
                                        </td>
                                    )}
                                    <td className={`px-5 py-3 ${isDisabled ? 'text-slate-400' : 'text-slate-700'}`}>
                                        {v.version_note}
                                    </td>
                                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                                        {fmtDate(v.created_at)}
                                    </td>
                                    <td className="px-5 py-3">
                                        {v.is_current && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                                Vigente
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {v.pdf_url && (
                                            <a
                                                href={v.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:underline text-xs font-medium"
                                            >
                                                PDF ↓
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Tab: Votaciones ──────────────────────────────────────────────────────────

function VotacionesTab({ votes }: { votes: BillVote[] }) {
    return (
        <div className="space-y-4">
            {votes.map(vote => (
                <VoteCard key={vote.id} vote={vote} />
            ))}
        </div>
    );
}

function VoteCard({ vote }: { vote: BillVote }) {
    const total = vote.yea_count + vote.nay_count + vote.abstain_count;
    const yeaPct = total > 0 ? Math.round((vote.yea_count / total) * 100) : 0;
    const nayPct = total > 0 ? Math.round((vote.nay_count / total) * 100) : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <p className="font-medium text-slate-800 text-sm">{vote.motion_text}</p>
                    <p className="text-xs text-slate-400 mt-1">
                        {CHAMBER_LABELS[vote.chamber] || vote.chamber}
                        {vote.vote_date && ` · ${fmtDate(vote.vote_date)}`}
                    </p>
                </div>
                {vote.result && (
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold shrink-0 ${
                        vote.result === 'pass'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                    }`}>
                        {vote.result === 'pass' ? 'Aprobado' : 'Rechazado'}
                    </span>
                )}
            </div>

            {/* Vote bar */}
            {total > 0 && (
                <div className="space-y-2">
                    <div className="flex h-4 rounded-full overflow-hidden gap-px">
                        {vote.yea_count > 0 && (
                            <div
                                className="bg-green-400 transition-all"
                                style={{ width: `${yeaPct}%` }}
                                title={`A favor: ${vote.yea_count}`}
                            />
                        )}
                        {vote.nay_count > 0 && (
                            <div
                                className="bg-red-400 transition-all"
                                style={{ width: `${nayPct}%` }}
                                title={`En contra: ${vote.nay_count}`}
                            />
                        )}
                        {vote.abstain_count > 0 && (
                            <div
                                className="bg-slate-300 flex-1"
                                title={`Abstención: ${vote.abstain_count}`}
                            />
                        )}
                    </div>
                    <div className="flex gap-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                            A favor: <strong>{vote.yea_count}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                            En contra: <strong>{vote.nay_count}</strong>
                        </span>
                        {vote.abstain_count > 0 && (
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span>
                                Abstención: <strong>{vote.abstain_count}</strong>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</dt>
            <dd className="mt-0.5 text-sm text-slate-700 truncate" title={value ?? undefined}>
                {value || <span className="text-slate-300">—</span>}
            </dd>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const lower = status.toLowerCase();
    let color = 'bg-slate-100 text-slate-600';
    if (lower.includes('aprobado') || lower.includes('firmado')) color = 'bg-green-100 text-green-800';
    else if (lower.includes('rechazado') || lower.includes('vetado')) color = 'bg-red-100 text-red-800';
    else if (lower.includes('comisión') || lower.includes('referido')) color = 'bg-yellow-100 text-yellow-800';
    else if (lower.includes('pendiente')) color = 'bg-orange-100 text-orange-700';

    return (
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${color}`}>
            {status}
        </span>
    );
}

function fmtDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('es-PR', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch {
        return dateStr;
    }
}
