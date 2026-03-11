'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  BookOpen,
  Download,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  GitMerge,
  GitCompare,
  Zap,
  Shield,
  Clock,
  X,
} from 'lucide-react';
import { DiffViewerPanel } from '@/components/comparator/DiffViewerPanel';
import { ImpactAnalysisPanel } from '@/components/comparator/ImpactAnalysisPanel';

const COMPARATOR_API = '/api/comparator';
const MAX_TEXT_CHARS = 50_000;

type UploadedDoc = {
  documentId: string;
  versionId: string;
  fileName: string;
  wordCount: number;
};

interface StakeholderEntity {
  name: string;
  type: 'agencia' | 'corporacion' | 'grupo_demografico' | 'individuo' | 'otro';
  impactDirection: 'positivo' | 'restrictivo' | 'neutro' | 'mixto';
  impactDescription: string;
  timeframe: { shortTerm?: string; mediumTerm?: string; longTerm?: string };
}

interface StakeholderAnalysis {
  entities: StakeholderEntity[];
  summary: string;
  overallImpact: 'positivo' | 'restrictivo' | 'neutro' | 'mixto';
}

type ChunkComparison = {
  sourceChunkId: string;
  targetChunkId: string;
  label?: string;
  diffHtml: string;
  sourceSideHtml?: string;
  targetSideHtml?: string;
  changeType?: string;
  impactScore?: number;
};

type LineStats = {
  linesAdded: number;
  linesDeleted: number;
  linesUnchanged: number;
  changePercentage: number;
};

type ComparisonResult = {
  comparisonId: string;
  status: string;
  sourceDocument: { title: string };
  targetDocument: { title: string };
  summary?: string;
  impactScore: number;
  totalChanges: number;
  chunkComparisons: ChunkComparison[];
  stakeholderAnalysis?: StakeholderAnalysis;
  lineStats?: LineStats;
};

type ResultTab = 'cambios' | 'resumen' | 'impacto';

const PROGRESS_STEPS = [
  { threshold: 0,  label: 'Iniciando análisis...' },
  { threshold: 10, label: 'Leyendo documentos...' },
  { threshold: 20, label: 'Extrayendo secciones...' },
  { threshold: 60, label: 'Generando comparativa...' },
  { threshold: 80, label: 'Analizando con IA...' },
  { threshold: 90, label: 'Detectando partes afectadas...' },
];

function getProgressLabel(progress: number): string {
  const step = [...PROGRESS_STEPS].reverse().find((s) => progress >= s.threshold);
  return step?.label ?? 'Procesando...';
}

function DropZone({
  label,
  color,
  doc,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  color: 'blue' | 'violet';
  doc: UploadedDoc | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  const id = `file-${label.replace(/\s/g, '-').toLowerCase()}`;
  const accent = color === 'blue'
    ? { ring: 'ring-blue-500', border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700', dot: 'bg-blue-500' }
    : { ring: 'ring-violet-500', border: 'border-violet-400', bg: 'bg-violet-50', text: 'text-violet-600', btn: 'bg-violet-600 hover:bg-violet-700', dot: 'bg-violet-500' };

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent.dot}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${accent.dot}`} />
          <h3 className="font-semibold text-gray-800 text-sm">{label}</h3>
        </div>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
            uploading
              ? `${accent.border} ${accent.bg}`
              : doc
              ? 'border-green-300 bg-green-50'
              : `border-gray-200 hover:${accent.border} hover:${accent.bg}`
          }`}
        >
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className={`w-8 h-8 mx-auto animate-spin ${accent.text}`} />
              <p className="text-sm text-gray-500">Procesando documento...</p>
            </div>
          ) : doc ? (
            <div className="space-y-2">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
              <div>
                <p className="font-medium text-gray-900 text-sm truncate px-2">{doc.fileName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{doc.wordCount.toLocaleString()} palabras</p>
              </div>
              <button
                onClick={onClear}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" /> Cambiar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-8 h-8 text-gray-300 mx-auto" />
              <div>
                <p className="text-sm text-gray-600">Arrastra aquí o</p>
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,.txt"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
                  className="hidden"
                  id={id}
                />
                <label
                  htmlFor={id}
                  className={`inline-block mt-2 px-4 py-1.5 ${accent.btn} text-white text-xs font-medium rounded-lg cursor-pointer transition-colors`}
                >
                  Seleccionar archivo
                </label>
              </div>
              <p className="text-xs text-gray-400">PDF · DOCX · TXT · máx 10MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
  color,
  icon,
}: {
  value: string | number;
  label: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-sm text-gray-600 mt-1">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function ComparatorPage() {
  const searchParams = useSearchParams();
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'text'>('upload');
  const [sourceDoc, setSourceDoc] = useState<UploadedDoc | null>(null);
  const [targetDoc, setTargetDoc] = useState<UploadedDoc | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [uploadingSource, setUploadingSource] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareProgress, setCompareProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>('cambios');
  const [autoLoading, setAutoLoading] = useState(false);
  const autoLoadDone = useRef(false);

  // Auto-load PDFs from query params (e.g. from /medidas/[id] → Comparar versiones)
  useEffect(() => {
    if (autoLoadDone.current) return;
    const sourcePdf = searchParams.get('source_pdf');
    const targetPdf = searchParams.get('target_pdf');
    if (!sourcePdf || !targetPdf) return;

    autoLoadDone.current = true;
    const sourceLabel = searchParams.get('source_label') || 'Versión anterior';
    const targetLabel = searchParams.get('target_label') || 'Versión nueva';

    async function fetchAndUpload(url: string, label: string, type: 'source' | 'target') {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el PDF: ${label}`);
      const blob = await res.blob();
      const fileName = `${label}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      await handleFileUpload(file, type);
    }

    setAutoLoading(true);
    setError(null);
    Promise.all([
      fetchAndUpload(sourcePdf, sourceLabel, 'source'),
      fetchAndUpload(targetPdf, targetLabel, 'target'),
    ])
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar los PDFs'))
      .finally(() => setAutoLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (file: File, type: 'source' | 'target') => {
    const setUploading = type === 'source' ? setUploadingSource : setUploadingTarget;
    const setDoc = type === 'source' ? setSourceDoc : setTargetDoc;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${COMPARATOR_API}/documents/upload?title=${encodeURIComponent(file.name)}&autoIngest=true`, {
        method: 'POST', body: formData,
      });
      if (!res.ok) throw new Error(`Error al subir: ${res.statusText}`);
      const data = await res.json();
      setDoc({ documentId: data.documentId, versionId: data.versionId, fileName: data.metadata.fileName, wordCount: data.metadata.wordCount });
      await waitForIngestion(data.versionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo');
      setDoc(null);
    } finally {
      setUploading(false);
    }
  };

  const waitForIngestion = async (versionId: string, maxAttempts = 45) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`${COMPARATOR_API}/documents/versions/${versionId}/status`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === 'READY') return;
        if (data.status === 'ERROR') throw new Error('Error al procesar el documento. Intenta subir el archivo de nuevo.');
      } catch (err) {
        if (err instanceof Error && err.message.includes('Error al procesar')) throw err;
      }
    }
    throw new Error('Tiempo de espera agotado al procesar el documento');
  };

  const waitForComparison = async (jobId: string, maxAttempts = 60): Promise<string> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${COMPARATOR_API}/comparison/jobs/${jobId}`);
      const data = await res.json();
      if (typeof data.progress === 'number') setCompareProgress(data.progress);
      if (data.status === 'completed' && data.result?.comparisonId) return data.result.comparisonId;
      if (data.status === 'failed') throw new Error(`Comparación fallida: ${data.error ?? 'error desconocido'}`);
    }
    throw new Error('Tiempo de espera agotado en la comparación');
  };

  const handleCompare = async () => {
    setComparing(true);
    setCompareProgress(0);
    setError(null);
    setResult(null);

    try {
      if (activeInputTab === 'text') {
        if (!sourceText.trim() || !targetText.trim()) throw new Error('Pega ambos textos primero');
        if (sourceText.length > MAX_TEXT_CHARS || targetText.length > MAX_TEXT_CHARS)
          throw new Error('El documento supera el límite de 50,000 caracteres');

        const res = await fetch(`${COMPARATOR_API}/comparison/quick-compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textA: sourceText, textB: targetText }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).message ?? 'Error al comparar los textos');
        }
        const data = await res.json();
        setResult({
          comparisonId: '',
          status: 'completed',
          sourceDocument: { title: 'Texto Original' },
          targetDocument: { title: 'Texto Propuesto' },
          impactScore: Math.round(data.stats.changePercentage),
          totalChanges: 1,
          chunkComparisons: [{
            sourceChunkId: 'text-a', targetChunkId: 'text-b',
            label: 'Documento completo',
            diffHtml: data.diffHtml,
            sourceSideHtml: data.sourceSideHtml,
            targetSideHtml: data.targetSideHtml,
          }],
          lineStats: data.stats,
        });
        setResultTab('cambios');
        return;
      }

      if (!sourceDoc || !targetDoc) throw new Error('Sube ambos documentos primero');

      const compareRes = await fetch(`${COMPARATOR_API}/comparison/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceVersionId: sourceDoc.versionId, targetVersionId: targetDoc.versionId, detectSemanticChanges: true }),
      });
      if (!compareRes.ok) throw new Error('Error al iniciar la comparación');

      const { jobId } = await compareRes.json();
      const comparisonId = await waitForComparison(jobId);

      const resultRes = await fetch(`${COMPARATOR_API}/projects/${comparisonId}/summary`);
      if (!resultRes.ok) throw new Error('Error al obtener los resultados');

      const resultData = await resultRes.json();
      setResult(resultData);
      setResultTab('resumen');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la comparación');
    } finally {
      setComparing(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comparación Legal</title>
    <style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:900px;margin:auto}h1{font-size:1.5rem;margin-bottom:.5rem}
    .meta{color:#666;font-size:.9rem;margin-bottom:2rem}.summary{background:#f0f9ff;border:1px solid #bae6fd;border-radius:.5rem;padding:1.5rem;margin-bottom:2rem}
    ins{background:#dcfce7;text-decoration:none;padding:.1em .2em;border-radius:.2em}del{background:#fee2e2;text-decoration:line-through;padding:.1em .2em;border-radius:.2em}
    @media print{body{padding:1rem}}</style></head><body>
    <h1>Comparación: ${result.sourceDocument.title} → ${result.targetDocument.title}</h1>
    <div class="meta">Score de impacto: ${result.impactScore} · Secciones analizadas: ${result.totalChanges} · Generado: ${new Date().toLocaleDateString('es-PR')}</div>
    ${result.summary ? `<div class="summary"><strong>Resumen Ejecutivo</strong><p>${result.summary}</p></div>` : ''}
    ${result.chunkComparisons.map((c) => `<h3>${c.label ?? 'Sección'}</h3><div>${c.diffHtml}</div>`).join('\n')}
    </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  const isDisabled =
    comparing ||
    (activeInputTab === 'upload' && (!sourceDoc || !targetDoc)) ||
    (activeInputTab === 'text' && (!sourceText.trim() || !targetText.trim())) ||
    (activeInputTab === 'text' && (sourceText.length > MAX_TEXT_CHARS || targetText.length > MAX_TEXT_CHARS));

  const impactLevel =
    result && result.impactScore > 70 ? 'alto'
    : result && result.impactScore > 40 ? 'medio'
    : 'bajo';

  const impactMeta: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    alto:  { color: 'text-red-600',    bg: 'bg-red-50',    icon: <TrendingUp className="w-5 h-5" />,  label: 'Alto Impacto' },
    medio: { color: 'text-amber-600',  bg: 'bg-amber-50',  icon: <GitMerge className="w-5 h-5" />,   label: 'Impacto Moderado' },
    bajo:  { color: 'text-emerald-600',bg: 'bg-emerald-50',icon: <TrendingDown className="w-5 h-5" />,label: 'Bajo Impacto' },
  };

  const criticalChanges = result?.chunkComparisons.filter(
    (c) => c.changeType === 'obligation_shift' || c.changeType === 'sanction_changed' || c.changeType === 'deadline_changed',
  ).length ?? 0;

  const expansions = result?.chunkComparisons.filter(
    (c) => c.changeType === 'scope_expanded' || c.changeType === 'scope_expansion',
  ).length ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* ── Auto-load banner ── */}
      {autoLoading && (
        <div className="flex items-center gap-3 px-5 py-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Cargando versiones del PDF automáticamente desde la medida…</span>
        </div>
      )}
      {!autoLoading && searchParams.get('source_pdf') && (sourceDoc || targetDoc) && (
        <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>PDFs cargados desde la medida. Presiona <strong>Comparar</strong> para analizar.</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <GitCompare className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Comparador de Leyes</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Detecta cambios legislativos, analiza impacto y genera inteligencia con IA.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-blue-500" /> Diff semántico</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-violet-500" /> Análisis IA</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-green-500" /> Procesamiento async</span>
        </div>
      </div>

      {/* ── Input mode tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(['upload', 'text'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveInputTab(tab); setError(null); }}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors ${
                activeInputTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'upload' ? <Upload className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              {tab === 'upload' ? 'Subir Archivos' : 'Pegar Texto'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Upload mode */}
          {activeInputTab === 'upload' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DropZone label="Ley Vigente · Original" color="blue" doc={sourceDoc} uploading={uploadingSource}
                onUpload={(f) => handleFileUpload(f, 'source')} onClear={() => setSourceDoc(null)} />
              <DropZone label="Propuesta · Nueva Versión" color="violet" doc={targetDoc} uploading={uploadingTarget}
                onUpload={(f) => handleFileUpload(f, 'target')} onClear={() => setTargetDoc(null)} />
            </div>
          )}

          {/* Text mode */}
          {activeInputTab === 'text' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Ley Vigente', value: sourceText, setter: setSourceText, ph: 'Pega el texto de la ley vigente...', color: 'focus:ring-blue-500 focus:border-blue-500' },
                { label: 'Propuesta', value: targetText, setter: setTargetText, ph: 'Pega el texto propuesto...', color: 'focus:ring-violet-500 focus:border-violet-500' },
              ].map(({ label, value, setter, ph, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className={`text-xs tabular-nums ${value.length > MAX_TEXT_CHARS ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {value.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    className={`w-full h-64 p-4 bg-gray-50 border-0 resize-none focus:ring-2 focus:ring-inset font-mono text-sm text-gray-800 placeholder-gray-400 outline-none ${color} ${value.length > MAX_TEXT_CHARS ? 'bg-red-50' : ''}`}
                    placeholder={ph}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="px-6 pb-6">
          {error && (
            <div className="flex items-start gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleCompare}
              disabled={isDisabled}
              className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 ${
                isDisabled
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5'
              }`}
            >
              {comparing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{getProgressLabel(compareProgress)}</>
              ) : (
                <><Sparkles className="w-4 h-4" />Analizar y Comparar</>
              )}
            </button>

            {comparing && (
              <div className="flex-1 w-full sm:w-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">{getProgressLabel(compareProgress)}</span>
                  <span className="text-xs font-medium text-blue-600">{compareProgress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-700"
                    style={{ width: `${compareProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-6">

          {/* Document header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium truncate max-w-xs">
                {result.sourceDocument.title}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg text-sm font-medium truncate max-w-xs">
                {result.targetDocument.title}
              </span>
              {result.comparisonId && (
                <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md border border-green-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Análisis completado
                </span>
              )}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>

          {/* Stats dashboard */}
          {result.lineStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                value={`${result.lineStats.changePercentage.toFixed(1)}%`}
                label="Porcentaje de cambio"
                color={impactMeta[impactLevel].bg}
                icon={<span className={impactMeta[impactLevel].color}>{impactMeta[impactLevel].icon}</span>}
              />
              <StatCard value={result.lineStats.linesAdded} label="Líneas añadidas" color="bg-green-50"
                icon={<TrendingUp className="w-5 h-5 text-green-600" />} />
              <StatCard value={result.lineStats.linesDeleted} label="Líneas eliminadas" color="bg-red-50"
                icon={<TrendingDown className="w-5 h-5 text-red-600" />} />
              <StatCard value={result.lineStats.linesUnchanged} label="Sin cambios" color="bg-gray-50"
                icon={<Minus className="w-5 h-5 text-gray-400" />} />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                value={result.impactScore}
                label="Score de impacto"
                sub={impactMeta[impactLevel].label}
                color={impactMeta[impactLevel].bg}
                icon={<span className={impactMeta[impactLevel].color}>{impactMeta[impactLevel].icon}</span>}
              />
              <StatCard value={result.totalChanges} label="Secciones analizadas" color="bg-blue-50"
                icon={<GitCompare className="w-5 h-5 text-blue-600" />} />
              <StatCard value={criticalChanges} label="Cambios críticos"
                sub={criticalChanges > 0 ? 'Obligaciones, sanciones, plazos' : 'Sin cambios críticos'}
                color="bg-red-50"
                icon={<Shield className="w-5 h-5 text-red-500" />} />
              <StatCard value={expansions} label="Expansiones de alcance"
                sub={expansions > 0 ? 'Nuevas inclusiones' : 'Sin expansiones'}
                color="bg-green-50"
                icon={<Zap className="w-5 h-5 text-green-500" />} />
            </div>
          )}

          {/* Result tabs — pill style */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
              <button
                onClick={() => setResultTab('cambios')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  resultTab === 'cambios'
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                }`}
              >
                <GitCompare className="w-4 h-4" />
                Cambios Detectados
                <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                  resultTab === 'cambios' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {result.totalChanges}
                </span>
              </button>

              <button
                onClick={() => setResultTab('resumen')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  resultTab === 'resumen'
                    ? 'bg-white text-violet-600 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Resumen IA
                {result.summary && (
                  <span className="px-1.5 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-700">✓</span>
                )}
              </button>

              <button
                onClick={() => setResultTab('impacto')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  resultTab === 'impacto'
                    ? 'bg-white text-emerald-600 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Análisis de Impacto
                {(result.stakeholderAnalysis?.entities.length ?? 0) > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                    resultTab === 'impacto' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {result.stakeholderAnalysis!.entities.length}
                  </span>
                )}
              </button>
            </div>

            <div className="p-6">

              {/* Tab: Cambios */}
              {resultTab === 'cambios' && (
                <DiffViewerPanel
                  chunks={result.chunkComparisons}
                  sourceTitle={result.sourceDocument.title}
                  targetTitle={result.targetDocument.title}
                />
              )}

              {/* Tab: Resumen IA */}
              {resultTab === 'resumen' && (
                <div className="max-w-3xl mx-auto">
                  {result.summary ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 rounded-lg">
                          <Sparkles className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Resumen Ejecutivo</h3>
                          <p className="text-xs text-gray-400">Generado por Gemini 2.0 Flash</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-6">
                        <p className="text-gray-700 leading-relaxed text-[15px]">{result.summary}</p>
                      </div>

                      {/* Quick insight chips based on chunk types */}
                      {result.chunkComparisons.some((c) => c.changeType && c.changeType !== 'no_semantic_change') && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tipos de cambio detectados</p>
                          <div className="flex flex-wrap gap-2">
                            {[...new Set(result.chunkComparisons.map((c) => c.changeType).filter(Boolean))].map((type) => {
                              const count = result.chunkComparisons.filter((c) => c.changeType === type).length;
                              const labels: Record<string, { label: string; color: string }> = {
                                obligation_shift:     { label: 'Cambio de obligación', color: 'bg-red-100 text-red-700 border-red-200' },
                                sanction_changed:     { label: 'Sanción modificada',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
                                deadline_changed:     { label: 'Plazo modificado',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
                                scope_expanded:       { label: 'Alcance ampliado',      color: 'bg-green-100 text-green-700 border-green-200' },
                                scope_reduced:        { label: 'Alcance reducido',      color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                                definition_modified:  { label: 'Definición cambiada',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
                                requirement_added:    { label: 'Requisito nuevo',       color: 'bg-violet-100 text-violet-700 border-violet-200' },
                                requirement_removed:  { label: 'Requisito eliminado',   color: 'bg-pink-100 text-pink-700 border-pink-200' },
                                no_semantic_change:   { label: 'Sin cambio semántico',  color: 'bg-gray-100 text-gray-600 border-gray-200' },
                              };
                              const meta = labels[type!] ?? { label: type!, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                              return (
                                <span key={type} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${meta.color}`}>
                                  {meta.label}
                                  {count > 1 && <span className="opacity-60">×{count}</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="p-4 bg-gray-100 rounded-2xl inline-block mb-4">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="font-medium text-gray-600 mb-1">Resumen no disponible</p>
                      <p className="text-sm text-gray-400">Configura <code className="bg-gray-100 px-1 rounded text-xs">GEMINI_API_KEY</code> para activar los resúmenes generados por IA.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Impacto */}
              {resultTab === 'impacto' && (
                result.stakeholderAnalysis ? (
                  <ImpactAnalysisPanel analysis={result.stakeholderAnalysis} />
                ) : (
                  <div className="text-center py-16">
                    <div className="p-4 bg-gray-100 rounded-2xl inline-block mb-4">
                      <BarChart3 className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="font-medium text-gray-600 mb-1">Análisis de impacto no disponible</p>
                    <p className="text-sm text-gray-400">Configura <code className="bg-gray-100 px-1 rounded text-xs">GEMINI_API_KEY</code> para activar el análisis de partes interesadas.</p>
                  </div>
                )
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
