'use client';

import { useState, useEffect } from 'react';
import {
  getCoalitions,
  createCoalition,
  getCoalitionById,
  deleteCoalition,
  addCoalitionMember,
  updateCoalitionMember,
  removeCoalitionMember,
  addCommitment,
  updateCommitment,
  addMessage,
  getMessages,
  searchLobbyists,
} from '@/lib/advanced-intelligence-api';
import { fetchBillsEnhanced } from '@/lib/api';

type Stance = 'support' | 'oppose' | 'neutral' | 'undecided';

const STANCE_CONFIG: Record<Stance, { label: string; bg: string; text: string }> = {
  support: { label: 'A favor', bg: 'bg-green-100', text: 'text-green-800' },
  oppose: { label: 'En contra', bg: 'bg-red-100', text: 'text-red-800' },
  neutral: { label: 'Neutral', bg: 'bg-slate-100', text: 'text-slate-700' },
  undecided: { label: 'Indeciso', bg: 'bg-amber-100', text: 'text-amber-800' },
};

interface Member {
  id: string;
  organization: string;
  stance: Stance;
  contact_name?: string;
  contact_email?: string;
}

interface Commitment {
  id: string;
  member_id?: string;
  description: string;
  due_date?: string;
  status: 'pending' | 'fulfilled' | 'failed';
}

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  author?: string;
}

interface Coalition {
  id: string;
  name: string;
  bill_id?: string;
  bill_number?: string;
  bill_title?: string;
  members?: Member[];
  commitments?: Commitment[];
  member_count?: number;
  pending_commitments?: number;
}

function StanceBadge({ stance }: { stance: Stance }) {
  const cfg = STANCE_CONFIG[stance] || STANCE_CONFIG.undecided;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function CoalitionCard({
  coalition,
  onSelect,
  onDelete,
}: {
  coalition: Coalition;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{coalition.name}</p>
          {(coalition.bill_number || coalition.bill_title) && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {coalition.bill_number && <span className="font-medium text-violet-700 mr-1">{coalition.bill_number}</span>}
              {coalition.bill_title}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-slate-300 hover:text-red-500 transition-colors p-1"
          title="Eliminar coalición"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          {coalition.member_count ?? coalition.members?.length ?? 0} miembros
        </div>
        {(coalition.pending_commitments ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            {coalition.pending_commitments} compromisos pendientes
          </div>
        )}
      </div>
    </div>
  );
}

function CoalitionDetail({
  coalition,
  token,
  onBack,
}: {
  coalition: Coalition;
  token: string;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'members' | 'commitments' | 'messages'>('members');
  const [detail, setDetail] = useState<Coalition>(coalition);
  const [messages, setMessages] = useState<Message[]>([]);
  const [lobbyists, setLobbyists] = useState<any[]>([]);
  const [lobbyistsExpanded, setLobbyistsExpanded] = useState(false);

  // Member form
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ organization: '', stance: 'neutral' as Stance, contact_name: '', contact_email: '' });
  const [addingMember, setAddingMember] = useState(false);

  // Commitment form
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);
  const [commitmentForm, setCommitmentForm] = useState({ description: '', due_date: '', member_id: '' });
  const [addingCommitment, setAddingCommitment] = useState(false);

  // Message form
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('note');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    getCoalitionById(coalition.id, token)
      .then(setDetail)
      .catch(() => {});
  }, [coalition.id, token]);

  useEffect(() => {
    if (activeTab !== 'messages') return;
    getMessages(coalition.id, token)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeTab, coalition.id, token]);

  async function handleAddMember() {
    if (!memberForm.organization) return;
    setAddingMember(true);
    try {
      await addCoalitionMember(coalition.id, memberForm, token);
      const updated = await getCoalitionById(coalition.id, token);
      setDetail(updated);
      setMemberForm({ organization: '', stance: 'neutral', contact_name: '', contact_email: '' });
      setShowMemberForm(false);
    } catch (_) {}
    setAddingMember(false);
  }

  async function handleRemoveMember(memberId: string) {
    await removeCoalitionMember(coalition.id, memberId, token);
    setDetail((d) => ({ ...d, members: d.members?.filter((m) => m.id !== memberId) }));
  }

  async function handleAddCommitment() {
    if (!commitmentForm.description) return;
    setAddingCommitment(true);
    try {
      await addCommitment(coalition.id, commitmentForm, token);
      const updated = await getCoalitionById(coalition.id, token);
      setDetail(updated);
      setCommitmentForm({ description: '', due_date: '', member_id: '' });
      setShowCommitmentForm(false);
    } catch (_) {}
    setAddingCommitment(false);
  }

  async function handleToggleCommitment(commitmentId: string, currentStatus: string) {
    const newStatus = currentStatus === 'pending' ? 'fulfilled' : 'pending';
    await updateCommitment(coalition.id, commitmentId, { status: newStatus }, token);
    setDetail((d) => ({
      ...d,
      commitments: d.commitments?.map((c) =>
        c.id === commitmentId ? { ...c, status: newStatus as any } : c
      ),
    }));
  }

  async function handleSendMessage() {
    if (!messageText.trim()) return;
    setSendingMessage(true);
    try {
      const msg = await addMessage(coalition.id, { content: messageText, message_type: messageType }, token);
      setMessages((prev) => [...prev, msg]);
      setMessageText('');
    } catch (_) {}
    setSendingMessage(false);
  }

  async function handleSearchLobbyists() {
    const results = await searchLobbyists('', undefined);
    setLobbyists(results || []);
  }

  const members = detail.members || [];
  const commitments = detail.commitments || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Volver
        </button>
        <span className="text-slate-300">|</span>
        <h2 className="text-sm font-bold text-slate-900">{detail.name}</h2>
        {detail.bill_number && (
          <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
            {detail.bill_number}
          </span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200">
        {(['members', 'commitments', 'messages'] as const).map((tab) => {
          const labels = { members: 'Miembros', commitments: 'Compromisos', messages: 'Mensajes' };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Members tab */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Sin miembros aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left pb-2 text-slate-500 font-semibold">Organización</th>
                    <th className="text-left pb-2 text-slate-500 font-semibold">Postura</th>
                    <th className="text-left pb-2 text-slate-500 font-semibold">Contacto</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{m.organization}</td>
                      <td className="py-2 pr-3"><StanceBadge stance={m.stance} /></td>
                      <td className="py-2 pr-3 text-slate-500">
                        {m.contact_name && <span>{m.contact_name}</span>}
                        {m.contact_email && <span className="ml-1 text-blue-600">&lt;{m.contact_email}&gt;</span>}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!showMemberForm ? (
            <button
              onClick={() => setShowMemberForm(true)}
              className="text-xs flex items-center gap-1.5 text-violet-700 font-semibold hover:text-violet-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar miembro
            </button>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700">Nuevo miembro</p>
              <input
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Organización *"
                value={memberForm.organization}
                onChange={(e) => setMemberForm((f) => ({ ...f, organization: e.target.value }))}
              />
              <select
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={memberForm.stance}
                onChange={(e) => setMemberForm((f) => ({ ...f, stance: e.target.value as Stance }))}
              >
                {Object.entries(STANCE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <input
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Nombre de contacto"
                value={memberForm.contact_name}
                onChange={(e) => setMemberForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
              <input
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Email de contacto"
                value={memberForm.contact_email}
                onChange={(e) => setMemberForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddMember}
                  disabled={addingMember || !memberForm.organization}
                  className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {addingMember ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setShowMemberForm(false)} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commitments tab */}
      {activeTab === 'commitments' && (
        <div className="space-y-3">
          {commitments.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Sin compromisos registrados.</p>
          ) : (
            <div className="space-y-2">
              {commitments.map((c) => (
                <div key={c.id} className={`flex items-start gap-3 p-3 rounded-lg border ${c.status === 'fulfilled' ? 'border-green-200 bg-green-50' : c.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                  <button
                    onClick={() => handleToggleCommitment(c.id, c.status)}
                    className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 transition-colors ${
                      c.status === 'fulfilled' ? 'bg-green-500 border-green-500' : 'border-slate-400 hover:border-violet-500'
                    }`}
                  >
                    {c.status === 'fulfilled' && (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-full h-full p-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${c.status === 'fulfilled' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {c.description}
                    </p>
                    {c.due_date && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Fecha límite: {new Date(c.due_date).toLocaleDateString('es-PR')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    c.status === 'fulfilled' ? 'bg-green-100 text-green-700' :
                    c.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {c.status === 'fulfilled' ? 'Cumplido' : c.status === 'failed' ? 'Fallido' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!showCommitmentForm ? (
            <button
              onClick={() => setShowCommitmentForm(true)}
              className="text-xs flex items-center gap-1.5 text-violet-700 font-semibold hover:text-violet-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar compromiso
            </button>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700">Nuevo compromiso</p>
              <input
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Descripción del compromiso *"
                value={commitmentForm.description}
                onChange={(e) => setCommitmentForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                type="date"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={commitmentForm.due_date}
                onChange={(e) => setCommitmentForm((f) => ({ ...f, due_date: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddCommitment}
                  disabled={addingCommitment || !commitmentForm.description}
                  className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {addingCommitment ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setShowCommitmentForm(false)} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages tab */}
      {activeTab === 'messages' && (
        <div className="space-y-3">
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin mensajes aún.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                      {m.message_type}
                    </span>
                    {m.author && <span className="text-xs text-slate-500">{m.author}</span>}
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(m.created_at).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">{m.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="note">Nota</option>
              <option value="update">Actualización</option>
              <option value="alert">Alerta</option>
              <option value="action_item">Tarea</option>
            </select>
            <input
              className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Escribe un mensaje..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              disabled={sendingMessage || !messageText.trim()}
              className="text-xs px-3 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {sendingMessage ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {/* Lobbyists section */}
      <div className="border-t border-slate-200 pt-4">
        <button
          onClick={() => {
            setLobbyistsExpanded((v) => !v);
            if (!lobbyistsExpanded && lobbyists.length === 0) handleSearchLobbyists();
          }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 transition-transform ${lobbyistsExpanded ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
          Cabilderos Registrados (Registro DOJ)
        </button>
        {lobbyistsExpanded && (
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Datos del Registro de Cabilderos del Departamento de Justicia de Puerto Rico. Información pública.
            </p>
            {lobbyists.length === 0 ? (
              <p className="text-xs text-slate-400">Sin resultados.</p>
            ) : (
              <div className="space-y-1">
                {lobbyists.slice(0, 10).map((l: any, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-700 py-1.5 border-b border-slate-100 last:border-0">
                    <span className="font-medium">{l.name || l.full_name}</span>
                    {l.sector && <span className="text-slate-400">{l.sector}</span>}
                    {l.client && <span className="text-slate-500 ml-auto">{l.client}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoalitionsTab() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [coalitions, setCoalitions] = useState<Coalition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Coalition | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBillSearch, setFormBillSearch] = useState('');
  const [formBillResults, setFormBillResults] = useState<any[]>([]);
  const [formBillId, setFormBillId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    getCoalitions(token)
      .then(setCoalitions)
      .catch(() => setCoalitions([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!formBillSearch || formBillSearch.length < 2) { setFormBillResults([]); return; }
    const t = setTimeout(() => {
      fetchBillsEnhanced({ search: formBillSearch, limit: 8 })
        .then((r: any) => setFormBillResults(r?.data || r || []))
        .catch(() => setFormBillResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [formBillSearch]);

  async function handleCreate() {
    if (!formName) return;
    setCreating(true);
    try {
      const c = await createCoalition({ name: formName, bill_id: formBillId }, token);
      setCoalitions((prev) => [c, ...prev]);
      setShowForm(false);
      setFormName('');
      setFormBillSearch('');
      setFormBillId('');
    } catch (_) {}
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta coalición?')) return;
    await deleteCoalition(id, token);
    setCoalitions((prev) => prev.filter((c) => c.id !== id));
  }

  if (selected) {
    return (
      <CoalitionDetail
        coalition={selected}
        token={token}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{coalitions.length} coalición{coalitions.length !== 1 ? 'es' : ''}</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva Coalición
        </button>
      </div>

      {showForm && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-900">Nueva coalición</p>
          <input
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Nombre de la coalición *"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <div className="relative">
            <input
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Vincular medida (opcional)..."
              value={formBillSearch}
              onChange={(e) => { setFormBillSearch(e.target.value); setFormBillId(''); }}
            />
            {formBillResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {formBillResults.map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => { setFormBillId(b.id); setFormBillSearch(b.bill_number || b.measure_number || ''); setFormBillResults([]); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-semibold text-violet-700 mr-2">{b.bill_number || b.measure_number}</span>
                    <span className="text-slate-600">{b.short_title || b.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !formName}
              className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {creating ? 'Creando...' : 'Crear'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-32 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : coalitions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <p className="text-sm font-medium">Sin coaliciones todavía</p>
          <p className="text-xs mt-1">Crea tu primera coalición usando el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coalitions.map((c) => (
            <CoalitionCard
              key={c.id}
              coalition={c}
              onSelect={() => setSelected(c)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
