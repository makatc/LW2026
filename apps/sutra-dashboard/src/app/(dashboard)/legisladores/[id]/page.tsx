'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    fetchLegislator,
    fetchLegislatorInteractions,
    fetchLegislatorIntelligence,
    fetchLegislatorPositions,
    fetchLegislatorStaff,
    createInteraction,
    uploadInteractionAttachment,
    searchMeasures,
    ingestLegislatorData,
    generateLegislatorProfile,
    getCompliancePdfUrl,
    fetchDojLobbyistsForLegislator,
    updateLegislatorPrivateMetadata,
} from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'intelligence', label: 'Perfil e Inteligencia', icon: '🧠' },
    { key: 'crm', label: 'Mi Relación', icon: '🤝' },
    { key: 'positions', label: 'Posiciones Activas', icon: '📊' },
    { key: 'compliance', label: 'Compliance', icon: '📋' },
] as const;

const PARTY_COLORS: Record<string, string> = {
    PNP: 'bg-blue-100 text-blue-700 border-blue-200',
    PPD: 'bg-red-100 text-red-700 border-red-200',
    PD: 'bg-green-100 text-green-700 border-green-200',
    MVC: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    PIP: 'bg-orange-100 text-orange-700 border-orange-200',
    Independiente: 'bg-gray-100 text-gray-600 border-gray-200',
};

const CONTACT_ICONS: Record<string, { icon: string; label: string }> = {
    reunion_presencial: { icon: '🤝', label: 'Reunión presencial' },
    llamada: { icon: '📞', label: 'Llamada telefónica' },
    correo: { icon: '📧', label: 'Correo electrónico' },
    evento: { icon: '🎟️', label: 'Evento' },
};

const POSITION_BADGES: Record<string, { color: string; label: string }> = {
    a_favor: { color: 'bg-green-100 text-green-700 border-green-200', label: '✅ A favor' },
    en_contra: { color: 'bg-red-100 text-red-700 border-red-200', label: '❌ En contra' },
    indeciso: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '🤔 Indeciso' },
    no_se_pronuncio: { color: 'bg-gray-100 text-gray-600 border-gray-200', label: '🔇 No se pronunció' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LegisladorFichaPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params.id as string;

    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'intelligence');
    const [showInteractionPanel, setShowInteractionPanel] = useState(false);
    const [showPrivateMetadataPanel, setShowPrivateMetadataPanel] = useState(false);

    useEffect(() => {
        router.replace(`/legisladores/${id}?tab=${activeTab}`, { scroll: false });
    }, [activeTab, id, router]);

    const { data: legislator, isLoading, error } = useQuery({
        queryKey: ['legislator', id],
        queryFn: () => fetchLegislator(id),
    });

    if (isLoading) return <LegislatorSkeleton />;
    if (error || !legislator) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700">Error cargando legislador</p>
                <Link href="/legisladores" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">← Volver a la lista</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back link */}
            <Link href="/legisladores" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
                ← Volver a legisladores
            </Link>

            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-5">
                    {legislator.photo_url ? (
                        <img
                            src={legislator.photo_url}
                            alt={legislator.full_name}
                            className="w-20 h-20 rounded-xl object-cover bg-slate-100 ring-2 ring-slate-200"
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-500 text-2xl font-bold ring-2 ring-indigo-100">
                            {legislator.full_name?.charAt(0)}
                        </div>
                    )}
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900">{legislator.full_name}</h1>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${PARTY_COLORS[legislator.party] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {legislator.party}
                            </span>
                            <span className="text-sm text-slate-500">
                                {legislator.chamber === 'upper' ? '🏛️ Senado' : '🏠 Cámara de Representantes'}
                            </span>
                            {legislator.district && (
                                <span className="text-sm text-slate-500">📍 {legislator.district}</span>
                            )}
                        </div>
                        
                        {/* Public Context Info */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
                            {legislator.phone && (
                                <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                                    📞 {legislator.phone}
                                </span>
                            )}
                            {legislator.email && (
                                <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                                    📧 <a href={`mailto:${legislator.email}`} className="text-indigo-600 hover:underline">{legislator.email}</a>
                                </span>
                            )}
                            {legislator.office && (
                                <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                                    🏢 Oficina {legislator.office}
                                </span>
                            )}
                        </div>

                        {/* Private Metadata Summary (If available) */}
                        <div className="flex flex-col gap-3 mt-3 text-sm text-amber-700">
                            {(legislator.private_metadata?.private_phone || legislator.private_metadata?.private_email) && (
                                <div className="flex flex-wrap gap-4 p-2 bg-amber-50 rounded border border-amber-200">
                                    <span className="font-medium">Contacto Principal Privado:</span>
                                    {legislator.private_metadata?.private_phone && (
                                        <span className="flex items-center gap-1.5">📱 {legislator.private_metadata.private_phone}</span>
                                    )}
                                    {legislator.private_metadata?.private_email && (
                                        <span className="flex items-center gap-1.5">✉️ {legislator.private_metadata.private_email}</span>
                                    )}
                                </div>
                            )}

                            {(legislator.private_metadata?.private_contacts?.length > 0) && (
                                <div className="flex flex-col gap-2 mt-2">
                                    {legislator.private_metadata.private_contacts.map((contact: any, idx: number) => (
                                        <div key={idx} className="flex flex-wrap gap-4 p-2.5 bg-amber-50/70 rounded border border-amber-200/60 justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100/50 text-amber-800 border border-amber-200">
                                                    {contact.category || 'Contacto'}
                                                </span>
                                                <span className="font-medium">{contact.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-amber-700">
                                                {contact.phone && <span>📞 {contact.phone}</span>}
                                                {contact.email && <span>📧 <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a></span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Committee badges */}
                        {legislator.memberships && legislator.memberships.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {legislator.memberships.map((m: any, i: number) => (
                                    <span key={i} className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-600">
                                        {m.committee_name} {m.role !== 'miembro' ? `(${m.role})` : ''}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                        <button
                            onClick={() => setShowInteractionPanel(true)}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                            <span>+</span> Nueva Interacción
                        </button>
                        <button
                            onClick={() => setShowPrivateMetadataPanel(true)}
                            className="px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                        >
                            ✏️ Editar Contacto Privado
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                            activeTab === tab.key
                                ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <span className="mr-1.5">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'intelligence' && <IntelligenceTab legislatorId={id} />}
                {activeTab === 'crm' && <CRMTab legislatorId={id} onNewInteraction={() => setShowInteractionPanel(true)} />}
                {activeTab === 'positions' && <PositionsTab legislatorId={id} onRegisterInteraction={() => setShowInteractionPanel(true)} />}
                {activeTab === 'compliance' && <ComplianceTab legislatorId={id} legislatorName={legislator.full_name} />}
            </div>

            {/* Interaction Panel */}
            {showInteractionPanel && (
                <InteractionPanel
                    legislatorId={id}
                    legislatorName={legislator.full_name}
                    staff={legislator.staff || []}
                    onClose={() => setShowInteractionPanel(false)}
                />
            )}

            {/* Private Metadata Panel */}
            {showPrivateMetadataPanel && (
                <PrivateMetadataPanel
                    legislatorId={id}
                    legislatorName={legislator.full_name}
                    initialData={legislator.private_metadata || {}}
                    onClose={() => setShowPrivateMetadataPanel(false)}
                />
            )}
        </div>
    );
}

// ─── Tab 1: Intelligence ──────────────────────────────────────────────────────

function IntelligenceTab({ legislatorId }: { legislatorId: string }) {
    const queryClient = useQueryClient();
    const [generating, setGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState<string | null>(null);

    const { data: profile, isLoading } = useQuery({
        queryKey: ['intelligence', legislatorId],
        queryFn: () => fetchLegislatorIntelligence(legislatorId),
    });

    const handleGenerate = async () => {
        setGenerating(true);
        setGenStatus('Ingiriendo datos legislativos...');
        try {
            await ingestLegislatorData(legislatorId);
            setGenStatus('Generando perfil con IA...');
            const result = await generateLegislatorProfile(legislatorId);
            if (result?.error) {
                setGenStatus(`⚠️ ${result.message}`);
            } else {
                setGenStatus('✅ Perfil generado exitosamente');
                queryClient.invalidateQueries({ queryKey: ['intelligence', legislatorId] });
            }
        } catch (err: any) {
            setGenStatus(`❌ Error: ${err.message}`);
        } finally {
            setGenerating(false);
        }
    };

    if (isLoading) return <TabSkeleton />;

    if (!profile) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <div className="text-5xl mb-4">🧠</div>
                <p className="text-lg text-slate-600 font-medium">Perfil de inteligencia no generado</p>
                <p className="text-sm text-slate-400 mt-2">
                    Haz clic para analizar el historial legislativo y generar un perfil con IA.
                </p>
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2 mx-auto"
                >
                    {generating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {genStatus}
                        </>
                    ) : (
                        '🧠 Generar perfil con IA'
                    )}
                </button>
                {genStatus && !generating && (
                    <p className="text-xs text-slate-500 mt-3">{genStatus}</p>
                )}
            </div>
        );
    }

    const topicLabels: Record<string, string> = {
        fiscal: '💰 Fiscal',
        labor: '👷 Laboral',
        health: '🏥 Salud',
        energy: '⚡ Energía',
        environmental: '🌿 Ambiente',
    };

    const tendencyLabels: Record<string, string> = {
        pro_incentivos: 'Pro incentivos',
        pro_austeridad: 'Pro austeridad',
        pro_trabajador: 'Pro trabajador',
        pro_empleador: 'Pro empleador',
        mixto: 'Mixto',
        sin_datos: 'Sin datos',
    };

    return (
        <div className="space-y-6">
            {/* Thematic Footprint */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🧠</span>
                    <h3 className="font-semibold text-slate-800">Huella Temática</h3>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-violet-100 text-violet-700 border border-violet-200">IA</span>
                </div>
                <p className="text-slate-600 leading-relaxed">{profile.thematic_footprint}</p>
            </div>

            {/* Topic Positions Grid */}
            {profile.topic_positions && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-800 mb-4">Posiciones por Tema</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(profile.topic_positions).map(([topic, data]: [string, any]) => (
                            <div key={topic} className="border border-slate-100 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">{topicLabels[topic] || topic}</span>
                                    <span className="text-xs text-slate-400">
                                        {Math.round((data.confidence || 0) * 100)}% confianza
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                                    <div
                                        className="bg-indigo-500 h-2 rounded-full transition-all"
                                        style={{ width: `${(data.confidence || 0) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-500">{tendencyLabels[data.tendency] || data.tendency}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Key Priorities */}
                {profile.key_priorities && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-800 mb-3">Prioridades Clave</h3>
                        <div className="flex flex-wrap gap-2">
                            {profile.key_priorities.map((p: string, i: number) => (
                                <span key={i} className="px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {p}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Voting Consistency */}
                {profile.voting_consistency && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-800 mb-3">Consistencia de Voto</h3>
                        <div className="flex items-center gap-4">
                            <div className="relative w-24 h-24">
                                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#e2e8f0"
                                        strokeWidth="3"
                                    />
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#6366f1"
                                        strokeWidth="3"
                                        strokeDasharray={`${(profile.voting_consistency.score || 0) * 100}, 100`}
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-800">
                                    {Math.round((profile.voting_consistency.score || 0) * 100)}%
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 flex-1">{profile.voting_consistency.description}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Tab 2: CRM Timeline ─────────────────────────────────────────────────────

function CRMTab({ legislatorId, onNewInteraction }: { legislatorId: string; onNewInteraction: () => void }) {
    const { data, isLoading } = useQuery({
        queryKey: ['interactions', legislatorId],
        queryFn: () => fetchLegislatorInteractions(legislatorId),
    });

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const interactions = data?.data || [];

    if (isLoading) return <TabSkeleton />;

    if (interactions.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <div className="text-5xl mb-4">🤝</div>
                <p className="text-lg text-slate-600 font-medium">Sin interacciones registradas</p>
                <p className="text-sm text-slate-400 mt-2">
                    Registra tu primera interacción con este legislador.
                </p>
                <button
                    onClick={onNewInteraction}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    + Registrar interacción
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={onNewInteraction}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                >
                    + Nueva Interacción
                </button>
            </div>

            {/* Timeline */}
            <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
                {interactions.map((inter: any) => {
                    const ct = CONTACT_ICONS[inter.contact_type] || { icon: '📌', label: inter.contact_type };
                    const isExpanded = expandedId === inter.id;

                    return (
                        <div key={inter.id} className="relative pl-14 pb-6">
                            <div className="absolute left-4 top-2 w-5 h-5 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center text-xs">
                                {ct.icon}
                            </div>
                            <div
                                className={`bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-indigo-200 transition-all ${isExpanded ? 'ring-1 ring-indigo-200' : ''}`}
                                onClick={() => setExpandedId(isExpanded ? null : inter.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-slate-800">{ct.label}</span>
                                        <span className="text-xs text-slate-400">
                                            {new Date(inter.interaction_date).toLocaleDateString('es-PR', {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {inter.measures?.length > 0 && (
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                                {inter.measures.length} medida(s)
                                            </span>
                                        )}
                                        {inter.attachment_count > 0 && (
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                                📎 {inter.attachment_count}
                                            </span>
                                        )}
                                        {inter.measures?.some((m: any) => m.position_expressed) && (
                                            <span className={`text-xs px-2 py-0.5 rounded border ${
                                                POSITION_BADGES[inter.measures[0].position_expressed]?.color || ''
                                            }`}>
                                                {POSITION_BADGES[inter.measures[0].position_expressed]?.label || ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Notes preview */}
                                {inter.notes && !isExpanded && (
                                    <p className="text-sm text-slate-500 mt-2 truncate">{inter.notes.slice(0, 100)}...</p>
                                )}

                                {/* Expanded view */}
                                {isExpanded && (
                                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                                        {inter.notes && (
                                            <div>
                                                <span className="text-xs font-medium text-slate-500 uppercase">Notas</span>
                                                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{inter.notes}</p>
                                            </div>
                                        )}
                                        {inter.next_step_description && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <span className="text-xs font-medium text-amber-700">📌 Próximo paso</span>
                                                <p className="text-sm text-amber-800 mt-1">{inter.next_step_description}</p>
                                                {inter.next_step_date && (
                                                    <p className="text-xs text-amber-600 mt-1">
                                                        📅 {new Date(inter.next_step_date).toLocaleDateString('es-PR')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {inter.participants?.length > 0 && (
                                            <div>
                                                <span className="text-xs font-medium text-slate-500 uppercase">Participantes</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {inter.participants.map((p: any, i: number) => (
                                                        <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded">
                                                            {p.staff_name || p.custom_name || 'Legislador directo'}
                                                            {p.staff_title && <span className="text-slate-400 ml-1">({p.staff_title})</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Tab 3: Positions ─────────────────────────────────────────────────────────

function PositionsTab({ legislatorId, onRegisterInteraction }: { legislatorId: string; onRegisterInteraction: () => void }) {
    const { data, isLoading } = useQuery({
        queryKey: ['positions', legislatorId],
        queryFn: () => fetchLegislatorPositions(legislatorId),
    });

    const positions = data?.data || [];

    if (isLoading) return <TabSkeleton />;

    if (positions.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-lg text-slate-600 font-medium">Sin posiciones registradas</p>
                <p className="text-sm text-slate-400 mt-2">
                    Las posiciones se registran al documentar interacciones o se predicen con IA.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Medida</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Posición</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Confianza</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {positions.map((pos: any) => (
                        <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                                <span className="text-sm font-medium text-slate-800">{pos.measure_number || '—'}</span>
                                {pos.measure_title && (
                                    <p className="text-xs text-slate-500 truncate max-w-xs">{pos.measure_title}</p>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 text-xs rounded border font-medium ${
                                    POSITION_BADGES[pos.position]?.color || 'bg-gray-100 text-gray-600'
                                }`}>
                                    {POSITION_BADGES[pos.position]?.label || pos.position}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded border ${
                                    pos.position_type === 'confirmada'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-violet-50 text-violet-700 border-violet-200 border-dashed'
                                }`}>
                                    {pos.position_type === 'confirmada' ? 'Confirmada' : '🤖 Sugerida por IA'}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {pos.confidence_score != null ? (
                                    <span className="text-xs text-slate-500">{Math.round(pos.confidence_score * 100)}%</span>
                                ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                                <button
                                    onClick={onRegisterInteraction}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Registrar interacción
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Tab 4: Compliance ────────────────────────────────────────────────────────

function ComplianceTab({ legislatorId, legislatorName }: { legislatorId: string; legislatorName: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['interactions', legislatorId, 'compliance'],
        queryFn: () => fetchLegislatorInteractions(legislatorId, { limit: 200 }),
    });

    const interactions = data?.data || [];

    // DECISION: Semester calculation for compliance
    const now = new Date();
    const currentSemester = now.getMonth() < 6 ? 1 : 2;
    const semesterLabel = `${currentSemester === 1 ? 'Enero - Junio' : 'Julio - Diciembre'} ${now.getFullYear()}`;

    const semesterInteractions = interactions.filter((i: any) => {
        const d = new Date(i.interaction_date);
        return d.getFullYear() === now.getFullYear() &&
            (currentSemester === 1 ? d.getMonth() < 6 : d.getMonth() >= 6);
    });

    if (isLoading) return <TabSkeleton />;

    return (
        <div className="space-y-6">
            {/* Semester Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-slate-800">Resumen Semestral</h3>
                        <p className="text-sm text-slate-500">{semesterLabel}</p>
                    </div>
                    <a
                        href={getCompliancePdfUrl(now.getFullYear(), currentSemester)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        📥 Descargar PDF para DOJ
                    </a>
                </div>

                {semesterInteractions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">Sin interacciones en este semestre.</p>
                ) : (
                    <table className="w-full">
                        <thead className="border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Medidas</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Participantes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {semesterInteractions.map((inter: any) => (
                                <tr key={inter.id}>
                                    <td className="px-3 py-2 text-sm text-slate-700">
                                        {new Date(inter.interaction_date).toLocaleDateString('es-PR')}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-slate-600">
                                        {CONTACT_ICONS[inter.contact_type]?.label || inter.contact_type}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-slate-600">
                                        {inter.measures?.map((m: any) => m.measure_reference || m.measure_id).join(', ') || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-slate-600">
                                        {inter.participants?.map((p: any) => p.staff_name || p.custom_name || 'Legislador').join(', ') || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Other Registered Actors - Mock */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                    <span className="text-lg">📋</span>
                    <div>
                        <h3 className="font-semibold text-slate-800">Otros actores registrados</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Información pública del Registro del Departamento de Justicia
                        </p>
                    </div>
                </div>
                <DojLobbyistSection legislatorName={legislatorName} />
            </div>
        </div>
    );
}

// ─── 7-Step Interaction Panel ─────────────────────────────────────────────────

function InteractionPanel({
    legislatorId,
    legislatorName,
    staff,
    onClose,
}: {
    legislatorId: string;
    legislatorName: string;
    staff: any[];
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    // Form state persisted across steps
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [customParticipant, setCustomParticipant] = useState('');
    const [contactType, setContactType] = useState<string>('');
    const [interactionDate, setInteractionDate] = useState(new Date().toISOString().slice(0, 16));
    const [selectedMeasures, setSelectedMeasures] = useState<any[]>([]);
    const [noSpecificMeasure, setNoSpecificMeasure] = useState(false);
    const [measurePositions, setMeasurePositions] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState('');
    const [nextStepText, setNextStepText] = useState('');
    const [nextStepDate, setNextStepDate] = useState('');
    const [files, setFiles] = useState<File[]>([]);

    // Measure search
    const [measureSearch, setMeasureSearch] = useState('');
    const { data: measureResults } = useQuery({
        queryKey: ['measureSearch', measureSearch],
        queryFn: () => searchMeasures(measureSearch),
        enabled: measureSearch.length > 2,
    });

    const canProceed = () => {
        switch (step) {
            case 1: return true; // Participants are optional
            case 2: return !!contactType;
            case 3: return noSpecificMeasure || selectedMeasures.length > 0;
            default: return true;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const participants = [
                // Always include the legislator directly
                { legislator_id: legislatorId },
                // Add staff participants
                ...selectedStaff.map(sid => ({ staff_id: sid, legislator_id: legislatorId })),
                // Add custom participant
                ...(customParticipant ? [{ legislator_id: legislatorId, custom_name: customParticipant }] : []),
            ];

            const measures = noSpecificMeasure ? [] : selectedMeasures.map((m: any) => ({
                measure_id: m.id || undefined,
                measure_reference: m.numero || m.label || undefined,
                position_expressed: measurePositions[m.id || m.label] || undefined,
            }));

            const result = await createInteraction({
                legislator_id: legislatorId,
                contact_type: contactType,
                interaction_date: interactionDate,
                notes: notes || undefined,
                next_step_description: nextStepText || undefined,
                next_step_date: nextStepDate || undefined,
                participants,
                measures,
            });

            // Upload files
            if (files.length > 0 && result?.id) {
                for (const file of files) {
                    try {
                        await uploadInteractionAttachment(result.id, file);
                    } catch (e) {
                        console.error('File upload failed:', e);
                    }
                }
            }

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['interactions', legislatorId] });
            queryClient.invalidateQueries({ queryKey: ['positions', legislatorId] });

            onClose();
        } catch (err) {
            console.error('Failed to save interaction:', err);
            alert('Error guardando la interacción. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div>
                        <h2 className="font-semibold text-slate-800">Nueva Interacción</h2>
                        <p className="text-xs text-slate-500">con {legislatorName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">Paso {step} de 7</span>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-slate-100">
                    <div className="h-1 bg-indigo-500 transition-all" style={{ width: `${(step / 7) * 100}%` }} />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* STEP 1: Participants */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">¿Con quién fue?</h3>
                            <p className="text-sm text-slate-500">
                                {legislatorName} ya está preseleccionado. Selecciona staff adicional si aplica.
                            </p>
                            {staff.length > 0 ? (
                                <div className="space-y-2">
                                    {staff.map((s: any) => (
                                        <label key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-indigo-200 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedStaff.includes(s.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedStaff([...selectedStaff, s.id]);
                                                    else setSelectedStaff(selectedStaff.filter(id => id !== s.id));
                                                }}
                                                className="rounded border-slate-300 text-indigo-600"
                                            />
                                            <div>
                                                <span className="text-sm font-medium text-slate-800">{s.name}</span>
                                                <span className="text-xs text-slate-500 ml-2">{s.title}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No hay staff registrado para este legislador.</p>
                            )}
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Persona no registrada</label>
                                <input
                                    type="text"
                                    value={customParticipant}
                                    onChange={e => setCustomParticipant(e.target.value)}
                                    placeholder="Nombre (opcional)"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Contact Type */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">¿Cómo fue el contacto?</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(CONTACT_ICONS).map(([type, info]) => (
                                    <button
                                        key={type}
                                        onClick={() => setContactType(type)}
                                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                                            contactType === type
                                                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                                : 'border-slate-200 hover:border-indigo-200'
                                        }`}
                                    >
                                        <div className="text-3xl mb-2">{info.icon}</div>
                                        <div className="text-sm font-medium text-slate-700">{info.label}</div>
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Fecha y hora</label>
                                <input
                                    type="datetime-local"
                                    value={interactionDate}
                                    onChange={e => setInteractionDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Measures */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">¿Sobre qué medida?</h3>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={noSpecificMeasure}
                                    onChange={e => setNoSpecificMeasure(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600"
                                />
                                <span className="text-sm text-slate-600">Sin medida específica — tema general</span>
                            </label>
                            {!noSpecificMeasure && (
                                <>
                                    <input
                                        type="text"
                                        value={measureSearch}
                                        onChange={e => setMeasureSearch(e.target.value)}
                                        placeholder="Buscar medida por número o título..."
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {measureResults?.bills?.length > 0 && (
                                        <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                                            {measureResults.bills.map((bill: any) => (
                                                <button
                                                    key={bill.id}
                                                    onClick={() => {
                                                        if (!selectedMeasures.find((m: any) => m.id === bill.id)) {
                                                            setSelectedMeasures([...selectedMeasures, bill]);
                                                        }
                                                        setMeasureSearch('');
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                                                >
                                                    <span className="text-sm font-medium text-slate-800">{bill.numero}</span>
                                                    <span className="text-xs text-slate-500 ml-2 truncate">{bill.titulo?.slice(0, 60)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedMeasures.length > 0 && (
                                        <div className="space-y-2">
                                            <span className="text-xs text-slate-500">Medidas seleccionadas:</span>
                                            {selectedMeasures.map((m: any) => (
                                                <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg">
                                                    <span className="text-sm text-indigo-700">{m.numero || m.titulo?.slice(0, 40)}</span>
                                                    <button onClick={() => setSelectedMeasures(selectedMeasures.filter((x: any) => x.id !== m.id))} className="text-indigo-400 hover:text-red-500">&times;</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Position */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">¿Qué posición expresó?</h3>
                            {selectedMeasures.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No hay medidas vinculadas.</p>
                            ) : (
                                selectedMeasures.map((m: any) => (
                                    <div key={m.id} className="space-y-2">
                                        <span className="text-sm font-medium text-slate-700">{m.numero}</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(POSITION_BADGES).map(([pos, info]) => (
                                                <button
                                                    key={pos}
                                                    onClick={() => setMeasurePositions({ ...measurePositions, [m.id]: pos })}
                                                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                                        measurePositions[m.id] === pos
                                                            ? `${info.color} border-current shadow-sm`
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {info.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* STEP 5: Notes */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">Notas</h3>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="¿Qué argumentos resonaron? ¿Qué preocupaciones expresó? ¿Qué prometió o pidió?"
                                rows={8}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-y"
                            />
                        </div>
                    )}

                    {/* STEP 6: Next Step */}
                    {step === 6 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">Próximo paso</h3>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Descripción</label>
                                <input
                                    type="text"
                                    value={nextStepText}
                                    onChange={e => setNextStepText(e.target.value)}
                                    placeholder="Ej: Enviar borrador de enmienda, Coordinar reunión de seguimiento..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={nextStepDate}
                                    onChange={e => setNextStepDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 7: Attachments */}
                    {step === 7 && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-slate-800">Adjuntos</h3>
                            <div
                                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors cursor-pointer"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files) {
                                        setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                                    }
                                }}
                                onClick={() => document.getElementById('file-input')?.click()}
                            >
                                <div className="text-3xl mb-2">📎</div>
                                <p className="text-sm text-slate-600">Arrastra archivos aquí o haz click para seleccionar</p>
                                <p className="text-xs text-slate-400 mt-1">PDF, Word, imágenes (máx. 10MB)</p>
                                <input id="file-input" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileAdd} />
                            </div>
                            {files.length > 0 && (
                                <div className="space-y-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">📄</span>
                                                <span className="text-sm text-slate-700 truncate max-w-[250px]">{f.name}</span>
                                                <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                                            </div>
                                            <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">&times;</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        {step === 1 ? 'Cancelar' : '← Atrás'}
                    </button>
                    {step < 7 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!canProceed()}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Siguiente →
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                'Guardar interacción'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── DOJ Lobbyist Section ─────────────────────────────────────────────────────

function DojLobbyistSection({ legislatorName }: { legislatorName: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['doj-lobbyists', legislatorName],
        queryFn: () => fetchDojLobbyistsForLegislator(legislatorName),
        enabled: !!legislatorName,
    });

    const lobbyists = data?.data || [];

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-2">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-4 w-full bg-slate-200 rounded" />
            </div>
        );
    }

    if (lobbyists.length === 0) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-500">
                    No se encontraron otros cabilderos registrados con actividad declarada con este legislador.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                    Ejecute el scraper DOJ para actualizar datos: POST /api/doj-registry/scrape
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {lobbyists.map((lob: any) => (
                <div key={lob.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                        <span className="text-sm font-medium text-slate-700">{lob.lobbyist_name}</span>
                        {lob.firm_name && (
                            <span className="text-xs text-slate-400 ml-2">({lob.firm_name})</span>
                        )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                        lob.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                        {lob.status === 'active' ? 'Activo' : lob.status}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Shared Skeletons ─────────────────────────────────────────────────────────

function LegislatorSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-5">
                    <div className="w-20 h-20 rounded-xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                        <div className="h-6 w-64 bg-slate-200 rounded" />
                        <div className="h-4 w-48 bg-slate-200 rounded" />
                    </div>
                </div>
            </div>
            <div className="flex gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 w-36 bg-slate-200 rounded" />)}
            </div>
            <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
    );
}

function TabSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="h-5 w-48 bg-slate-200 rounded mb-3" />
                    <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                </div>
            ))}
        </div>
    );
}

// ─── Private Metadata Panel ───────────────────────────────────────────────────

function PrivateMetadataPanel({
    legislatorId,
    legislatorName,
    initialData,
    onClose,
}: {
    legislatorId: string;
    legislatorName: string;
    initialData: any;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);
    
    const [email, setEmail] = useState(initialData?.private_email || '');
    const [phone, setPhone] = useState(initialData?.private_phone || '');
    const [notes, setNotes] = useState(initialData?.private_notes || '');

    const [contacts, setContacts] = useState<any[]>(initialData?.private_contacts || []);

    const CATEGORIES = [
        'Dirección',
        'Asesoría Legislativa/Legal',
        'Servicios a Constituyentes',
        'Comunicaciones',
        'Administración y Apoyo',
    ];

    const addContact = () => {
        setContacts([...contacts, { category: 'Dirección', name: '', email: '', phone: '' }]);
    };

    const removeContact = (idx: number) => {
        setContacts(contacts.filter((_, i) => i !== idx));
    };

    const updateContact = (idx: number, field: string, value: string) => {
        const newContacts = [...contacts];
        newContacts[idx][field] = value;
        setContacts(newContacts);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateLegislatorPrivateMetadata(legislatorId, {
                private_email: email,
                private_phone: phone,
                private_notes: notes,
                private_contacts: contacts.filter(c => c.name || c.email || c.phone)
            });
            
            queryClient.invalidateQueries({ queryKey: ['legislator', legislatorId] });
            onClose();
        } catch (e) {
            console.error('Failed to save private metadata', e);
            alert('Error al guardar. Por favor, intente nuevamente.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
                <div className="px-6 py-5 border-b border-amber-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                    <div>
                        <h2 className="text-xl font-bold text-amber-900">Gestión de Contactos Privados</h2>
                        <p className="text-sm text-amber-700 font-medium">{legislatorName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-full text-amber-500 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Main Contact Group */}
                    <div className="bg-amber-50/70 p-6 rounded-2xl border border-amber-200/50 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-amber-900">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <h3 className="font-bold">Contacto Directo (Personal)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider">Teléfono Directo</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Ej: (787) 555-1212"
                                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm bg-white/80 transition-shadow"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider">Email Personal</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Ej: nombre@hotmail.com"
                                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm bg-white/80 transition-shadow"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Staff / Contacts List */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-slate-900 border-b-2 border-indigo-500 pb-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <h3 className="font-bold">Equipo y Asesores</h3>
                            </div>
                            <button 
                                onClick={addContact} 
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-200"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Añadir Persona
                            </button>
                        </div>
                        
                        {contacts.length === 0 && (
                            <div className="py-12 text-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200">
                                <p className="text-slate-400 font-medium">No has añadido personas de contacto adicionales.</p>
                            </div>
                        )}

                        <div className="space-y-6">
                            {contacts.map((contact, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative group hover:border-indigo-300 transition-all hover:shadow-md">
                                    <button 
                                        onClick={() => removeContact(idx)} 
                                        className="absolute right-4 top-4 text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                                        title="Eliminar contacto"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                                                <input
                                                    type="text"
                                                    value={contact.name}
                                                    onChange={(e) => updateContact(idx, 'name', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-shadow"
                                                    placeholder="Ej: José Rivera"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase">Categoría / Función</label>
                                                <select
                                                    value={contact.category}
                                                    onChange={(e) => updateContact(idx, 'category', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium bg-slate-50 transition-shadow"
                                                >
                                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase">Correo Electrónico</label>
                                            <input
                                                type="email"
                                                value={contact.email}
                                                onChange={(e) => updateContact(idx, 'email', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm transition-shadow"
                                                placeholder="email@servidor.com"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase">Teléfono Movil / Ofic.</label>
                                            <input
                                                type="text"
                                                value={contact.phone}
                                                onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm transition-shadow"
                                                placeholder="(787) 000-0000"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-800">Notas Estratégicas y Privadas</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-5 py-4 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 h-32 text-sm shadow-inner transition-shadow"
                            placeholder="Escribe aquí intereses específicos, mejores formas de acercarse, o notas de color sobre el legislador..."
                        />
                    </div>
                </div>

                <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/80 backdrop-blur-md flex justify-end gap-4">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        Salir sin guardar
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving} 
                        className="px-10 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-indigo-800 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-100 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            'Guardar Cambios'
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
