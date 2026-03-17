'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  uploadContractForAnalysis,
  getAnalysisStatus,
  getContractReport,
  getUserContractAnalyses,
  deleteContractAnalysis,
} from '@/lib/advanced-intelligence-api';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const RISK_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  high:   { label: 'Alto',  dot: 'bg-red-500',    badge: 'bg-red-100 text-red-800' },
  medium: { label: 'Medio', dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-800' },
  low:    { label: 'Bajo',  dot: 'bg-green-500',  badge: 'bg-green-100 text-green-800' },
};

const STEPS = [
  { key: 'extracting',   label: 'Extrayendo texto' },
  { key: 'identifying',  label: 'Identificando cláusulas' },
  { key: 'analyzing',    label: 'Analizando conflictos' },
  { key: 'generating',   label: 'Generando reporte' },
];

interface Conflict {
  law_name: string;
  article?: string;
  conflict_type: string;
  description: string;
  suggested_correction?: string;
}

interface Clause {
  id: string;
  number: number;
  text: string;
  risk_level: 'high' | 'medium' | 'low';
  conflicts: Conflict[];
}

interface Report {
  id: string;
  clauses: Clause[];
  summary?: string;
  created_at: string;
}

// ─── Drag & Drop Zone ────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (f.size > MAX_FILE_BYTES) { alert('El archivo supera los 10 MB.'); return; }
    if (!ACCEPTED_TYPES.includes(f.type)) { alert('Solo se aceptan PDF o Word (.docx).'); return; }
    onFile(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
        dragging ? 'border-violet-500 bg-violet-50' : 'border-slate-300 hover:border-violet-400 hover:bg-slate-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">Arrastra tu contrato aquí</p>
        <p className="text-xs text-slate-400 mt-1">PDF o Word · Máximo 10 MB</p>
        <p className="text-xs text-violet-600 mt-1 font-medium">o haz clic para seleccionar</p>
      </div>
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressIndicator({ status }: { status: string }) {
  const stepKeys = STEPS.map((s) => s.key);
  const currentIndex = stepKeys.indexOf(status);

  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((step, i) => {
        const done = i < currentIndex || (status === 'completed' && i <= currentIndex);
        const active = i === currentIndex && status !== 'completed';
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center w-full">
              {i > 0 && <div className={`flex-1 h-0.5 ${done || active ? 'bg-violet-400' : 'bg-slate-200'}`} />}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                done ? 'bg-violet-600 border-violet-600 text-white' :
                active ? 'border-violet-600 text-violet-700 bg-violet-50' :
                'border-slate-200 text-slate-400 bg-white'
              }`}>
                {done ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : active ? (
                  <span className="w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? 'bg-violet-400' : 'bg-slate-200'}`} />}
            </div>
            <p className={`text-xs text-center ${active ? 'text-violet-700 font-semibold' : done ? 'text-slate-500' : 'text-slate-300'}`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Report View ──────────────────────────────────────────────────────────────

function ReportView({ report, onReset }: { report: Report; onReset: () => void }) {
  const [selectedClause, setSelectedClause] = useState<Clause | null>(
    report.clauses?.[0] || null
  );

  function handleExport() {
    const lines: string[] = [`REPORTE DE ANÁLISIS DE CONTRATO\nGenerado: ${new Date(report.created_at).toLocaleString('es-PR')}\n\n`];
    report.clauses.forEach((c) => {
      lines.push(`--- Cláusula ${c.number} [Riesgo: ${c.risk_level.toUpperCase()}] ---\n${c.text}\n`);
      if (c.conflicts.length > 0) {
        lines.push(`Conflictos detectados:\n`);
        c.conflicts.forEach((cf) => {
          lines.push(`  • ${cf.law_name}${cf.article ? ` Art. ${cf.article}` : ''} — ${cf.conflict_type}\n`);
          lines.push(`    ${cf.description}\n`);
          if (cf.suggested_correction) lines.push(`    Sugerencia: ${cf.suggested_correction}\n`);
        });
      }
      lines.push('\n');
    });
    const blob = new Blob([lines.join('')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-contrato-${report.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Nuevo análisis
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500">
            {report.clauses?.length || 0} cláusulas analizadas
          </span>
        </div>
        <button
          onClick={handleExport}
          className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar Reporte
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 h-[500px]">
        {/* Clause list (40%) */}
        <div className="w-2/5 border border-slate-200 rounded-xl overflow-y-auto bg-white">
          <div className="sticky top-0 bg-slate-50 border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cláusulas</p>
          </div>
          <div className="divide-y divide-slate-100">
            {(report.clauses || []).map((clause) => {
              const riskCfg = RISK_CONFIG[clause.risk_level] || RISK_CONFIG.low;
              return (
                <button
                  key={clause.id}
                  onClick={() => setSelectedClause(clause)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selectedClause?.id === clause.id ? 'bg-violet-50 border-l-2 border-violet-500' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${riskCfg.dot}`} />
                    <span className="text-xs font-semibold text-slate-700">Cláusula {clause.number}</span>
                    <span className={`text-xs ml-auto px-1.5 py-0.5 rounded font-medium ${riskCfg.badge}`}>
                      {riskCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 ml-4">{clause.text}</p>
                  {clause.conflicts.length > 0 && (
                    <p className="text-xs text-red-600 mt-1 ml-4 font-medium">
                      {clause.conflicts.length} conflicto{clause.conflicts.length !== 1 ? 's' : ''} detectado{clause.conflicts.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel (60%) */}
        <div className="flex-1 border border-slate-200 rounded-xl overflow-y-auto bg-white">
          {!selectedClause ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Selecciona una cláusula
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-slate-900">Cláusula {selectedClause.number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(RISK_CONFIG[selectedClause.risk_level] || RISK_CONFIG.low).badge}`}>
                  Riesgo {(RISK_CONFIG[selectedClause.risk_level] || RISK_CONFIG.low).label}
                </span>
              </div>

              {/* Clause text */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedClause.text}</p>
              </div>

              {/* Conflicts */}
              {selectedClause.conflicts.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Sin conflictos detectados en esta cláusula
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Conflictos detectados ({selectedClause.conflicts.length})
                  </p>
                  {selectedClause.conflicts.map((cf, i) => (
                    <div key={i} className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-red-900">{cf.law_name}</p>
                          {cf.article && (
                            <p className="text-xs text-red-700">Artículo {cf.article}</p>
                          )}
                        </div>
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded font-medium flex-shrink-0">
                          {cf.conflict_type}
                        </span>
                      </div>
                      <p className="text-xs text-red-800 leading-relaxed">{cf.description}</p>
                      {cf.suggested_correction && (
                        <div className="bg-white border border-amber-200 rounded-lg p-3 mt-2">
                          <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            Corrección sugerida
                          </p>
                          <p className="text-xs text-amber-800">{cf.suggested_correction}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Aviso legal:</strong> Este análisis es generado automáticamente por inteligencia artificial con fines informativos y no constituye asesoramiento legal. Los resultados deben ser revisados por un abogado habilitado antes de tomar decisiones. LegalWatch no se hace responsable por decisiones tomadas exclusivamente en base a este reporte.
        </p>
      </div>
    </div>
  );
}

// ─── Analysis History ─────────────────────────────────────────────────────────

function AnalysisHistory({
  history,
  onLoad,
  onDelete,
}: {
  history: any[];
  onLoad: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="border-t border-slate-200 pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
        Análisis anteriores ({history.length})
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          {history.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 line-clamp-1">
                  {item.filename || `Análisis ${item.id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}
                  {item.clause_count && ` · ${item.clause_count} cláusulas`}
                </p>
              </div>
              <button
                onClick={() => onLoad(item)}
                className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium hover:bg-slate-200"
              >
                Ver
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

type Phase = 'drop' | 'confirm' | 'processing' | 'report';

export default function ContractAnalyzerTab() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [phase, setPhase] = useState<Phase>('drop');
  const [file, setFile] = useState<File | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('extracting');
  const [report, setReport] = useState<Report | null>(null);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load history on mount
  useEffect(() => {
    if (!token) return;
    getUserContractAnalyses(token)
      .then((items) => setHistory((items || []).slice(0, 5)))
      .catch(() => {});
  }, [token]);

  // Poll status while processing
  useEffect(() => {
    if (phase !== 'processing' || !analysisId) return;

    pollRef.current = setInterval(async () => {
      try {
        const status = await getAnalysisStatus(analysisId, token);
        setProcessingStatus(status.step || status.status || 'extracting');

        if (status.status === 'completed' || status.step === 'done') {
          clearInterval(pollRef.current!);
          const r = await getContractReport(analysisId, token);
          setReport(r);
          setPhase('report');
        } else if (status.status === 'failed' || status.status === 'error') {
          clearInterval(pollRef.current!);
          alert('El análisis falló. Intenta de nuevo.');
          setPhase('drop');
        }
      } catch (_) {}
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, analysisId, token]);

  async function handleUpload() {
    if (!file || !token) return;
    setUploading(true);
    try {
      const res = await uploadContractForAnalysis(file, token);
      setAnalysisId(res.analysisId);
      setProcessingStatus('extracting');
      setPhase('processing');
    } catch (e: any) {
      alert(e.message || 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteHistory(id: string) {
    await deleteContractAnalysis(id, token).catch(() => {});
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }

  async function handleLoadHistory(item: any) {
    try {
      const r = await getContractReport(item.id, token);
      setReport(r);
      setAnalysisId(item.id);
      setPhase('report');
    } catch (_) {}
  }

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  // Report view
  if (phase === 'report' && report) {
    return (
      <div className="space-y-6">
        <ReportView report={report} onReset={() => { setPhase('drop'); setFile(null); setReport(null); setAnalysisId(null); }} />
        <AnalysisHistory history={history} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} />
      </div>
    );
  }

  // Processing view
  if (phase === 'processing') {
    return (
      <div className="space-y-8 py-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">Analizando contrato...</p>
          <p className="text-xs text-slate-400">Esto puede tomar 30-60 segundos</p>
        </div>
        <ProgressIndicator status={processingStatus} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File confirm */}
      {phase === 'confirm' && file ? (
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-violet-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={() => { setFile(null); setPhase('drop'); }}
              className="text-slate-400 hover:text-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.813 15.904 9-13.5M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09Z" />
                </svg>
                Analizar Contrato
              </>
            )}
          </button>
        </div>
      ) : (
        <DropZone onFile={(f) => { setFile(f); setPhase('confirm'); }} />
      )}

      {/* History */}
      <AnalysisHistory history={history} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} />
    </div>
  );
}
