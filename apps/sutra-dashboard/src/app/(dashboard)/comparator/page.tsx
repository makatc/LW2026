'use client';

import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
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
  timeframe: {
    shortTerm?: string;
    mediumTerm?: string;
    longTerm?: string;
  };
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

function DropZone({
  label,
  doc,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">{label}</h3>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          uploading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
            <p className="text-sm text-gray-600">Procesando documento...</p>
          </div>
        ) : doc ? (
          <div className="space-y-3">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <div>
              <p className="font-medium text-gray-900">{doc.fileName}</p>
              <p className="text-sm text-gray-500">{doc.wordCount.toLocaleString()} palabras</p>
            </div>
            <button onClick={onClear} className="text-sm text-blue-600 hover:text-blue-700">
              Cambiar archivo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm font-medium text-gray-700">Arrastra un archivo aquí</p>
              <p className="text-xs text-gray-500 mt-1">o haz clic para seleccionar</p>
            </div>
            <p className="text-xs text-gray-400">Word, PDF, TXT (max 10MB)</p>
            <input
              type="file"
              accept=".doc,.docx,.pdf,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
              className="hidden"
              id={id}
            />
            <label
              htmlFor={id}
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Seleccionar Archivo
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparatorPage() {
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'text'>('upload');

  // Upload state
  const [sourceDoc, setSourceDoc] = useState<UploadedDoc | null>(null);
  const [targetDoc, setTargetDoc] = useState<UploadedDoc | null>(null);

  // Text input state
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');

  // UI state
  const [uploadingSource, setUploadingSource] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>('cambios');
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const handleFileUpload = async (file: File, type: 'source' | 'target') => {
    const setUploading = type === 'source' ? setUploadingSource : setUploadingTarget;
    const setDoc = type === 'source' ? setSourceDoc : setTargetDoc;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `${COMPARATOR_API}/documents/upload?title=${encodeURIComponent(file.name)}&autoIngest=true`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Error al subir: ${response.statusText}`);

      const data = await response.json();
      setDoc({
        documentId: data.documentId,
        versionId: data.versionId,
        fileName: data.metadata.fileName,
        wordCount: data.metadata.wordCount,
      });

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
        // red network — continue polling
      }
    }
    throw new Error('Tiempo de espera agotado al procesar el documento');
  };

  const waitForComparison = async (jobId: string, maxAttempts = 60): Promise<string> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${COMPARATOR_API}/comparison/jobs/${jobId}`);
      const data = await res.json();
      if (data.status === 'completed' && data.result?.comparisonId) return data.result.comparisonId;
      if (data.status === 'failed') throw new Error(`El trabajo de comparación falló: ${data.error ?? 'error desconocido'}`);
    }
    throw new Error('Tiempo de espera agotado en la comparación');
  };

  const handleCompare = async () => {
    setComparing(true);
    setError(null);
    setResult(null);

    try {
      let sourceVersionId = '';
      let targetVersionId = '';

      if (activeInputTab === 'text') {
        // Direct synchronous text comparison — no queue, no DB
        if (!sourceText.trim() || !targetText.trim()) throw new Error('Pega ambos textos primero');
        if (sourceText.length > MAX_TEXT_CHARS || targetText.length > MAX_TEXT_CHARS) {
          throw new Error('El documento supera el límite de 50,000 caracteres');
        }

        const res = await fetch(`${COMPARATOR_API}/comparison/quick-compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textA: sourceText, textB: targetText }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? 'Error al comparar los textos');
        }

        const data = await res.json();
        setResult({
          comparisonId: '',
          status: 'completed',
          sourceDocument: { title: 'Texto Original' },
          targetDocument: { title: 'Texto Propuesto' },
          impactScore: Math.round(data.stats.changePercentage),
          totalChanges: 1,
          chunkComparisons: [
            {
              sourceChunkId: 'text-a',
              targetChunkId: 'text-b',
              label: 'Documento completo',
              diffHtml: data.diffHtml,
              sourceSideHtml: data.sourceSideHtml,
              targetSideHtml: data.targetSideHtml,
            },
          ],
          lineStats: data.stats,
        });
        setResultTab('cambios');
        return;
      }

      if (!sourceDoc || !targetDoc) throw new Error('Sube ambos documentos primero');
      sourceVersionId = sourceDoc.versionId;
      targetVersionId = targetDoc.versionId;

      const compareRes = await fetch(`${COMPARATOR_API}/comparison/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceVersionId, targetVersionId, detectSemanticChanges: true }),
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

  const handleExport = async () => {
    if (!result) return;
    const res = await fetch(`${COMPARATOR_API}/projects/${result.comparisonId}/export`);
    const data = await res.json();
    alert(data.message ?? 'Exportación en proceso');
  };

  const impactColor =
    result?.impactScore && result.impactScore > 70
      ? 'text-red-600'
      : result?.impactScore && result.impactScore > 40
      ? 'text-yellow-600'
      : 'text-green-600';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Comparador de Leyes</h1>
        <p className="text-gray-600 mt-1">
          Compara versiones de documentos legislativos, detecta cambios y analiza impacto.
        </p>
      </header>

      {/* Input tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveInputTab('upload')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeInputTab === 'upload'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="inline w-4 h-4 mr-2" />
          Subir Archivos
        </button>
        <button
          onClick={() => setActiveInputTab('text')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeInputTab === 'text'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="inline w-4 h-4 mr-2" />
          Pegar Texto
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Upload tab */}
      {activeInputTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DropZone
            label="Ley Vigente (Original)"
            doc={sourceDoc}
            uploading={uploadingSource}
            onUpload={(f) => handleFileUpload(f, 'source')}
            onClear={() => setSourceDoc(null)}
          />
          <DropZone
            label="Propuesta (Nueva Versión)"
            doc={targetDoc}
            uploading={uploadingTarget}
            onUpload={(f) => handleFileUpload(f, 'target')}
            onClear={() => setTargetDoc(null)}
          />
        </div>
      )}

      {/* Text tab */}
      {activeInputTab === 'text' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Ley Vigente</h3>
              <span className={`text-xs ${sourceText.length > MAX_TEXT_CHARS ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                {sourceText.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
              </span>
            </div>
            <textarea
              className={`w-full h-80 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                sourceText.length > MAX_TEXT_CHARS ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Pega el texto original aquí..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Propuesta</h3>
              <span className={`text-xs ${targetText.length > MAX_TEXT_CHARS ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                {targetText.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
              </span>
            </div>
            <textarea
              className={`w-full h-80 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                targetText.length > MAX_TEXT_CHARS ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Pega el texto nuevo aquí..."
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Compare button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={
            comparing ||
            (activeInputTab === 'upload' && (!sourceDoc || !targetDoc)) ||
            (activeInputTab === 'text' && (!sourceText || !targetText)) ||
            (activeInputTab === 'text' && (sourceText.length > MAX_TEXT_CHARS || targetText.length > MAX_TEXT_CHARS))
          }
          className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors shadow-lg ${
            comparing ||
            (activeInputTab === 'upload' && (!sourceDoc || !targetDoc)) ||
            (activeInputTab === 'text' && (!sourceText || !targetText)) ||
            (activeInputTab === 'text' && (sourceText.length > MAX_TEXT_CHARS || targetText.length > MAX_TEXT_CHARS))
              ? 'bg-gray-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
          }`}
        >
          {comparing ? (
            <>
              <Loader2 className="inline w-5 h-5 mr-2 animate-spin" />
              Analizando documentos...
            </>
          ) : (
            'Comparar Documentos'
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Stats header */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Análisis Completado</h2>
                <p className="text-gray-600 mt-1">
                  {result.sourceDocument.title} → {result.targetDocument.title}
                </p>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar PDF
              </button>
            </div>

            {result.lineStats ? (
              /* Text-mode stats: line-level breakdown */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className={`text-3xl font-bold ${impactColor}`}>
                    {result.lineStats.changePercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">% Cambio</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{result.lineStats.linesAdded}</div>
                  <div className="text-sm text-gray-600 mt-1">Líneas Añadidas</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{result.lineStats.linesDeleted}</div>
                  <div className="text-sm text-gray-600 mt-1">Líneas Eliminadas</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-400">{result.lineStats.linesUnchanged}</div>
                  <div className="text-sm text-gray-600 mt-1">Sin Cambio</div>
                </div>
              </div>
            ) : (
              /* Upload-mode stats: chunk-level breakdown */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className={`text-3xl font-bold ${impactColor}`}>{result.impactScore}</div>
                  <div className="text-sm text-gray-600 mt-1">Score de Impacto</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900">{result.totalChanges}</div>
                  <div className="text-sm text-gray-600 mt-1">Secciones Cambiadas</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {result.chunkComparisons.filter(
                      (c) => c.changeType === 'scope_expansion' || c.changeType === 'scope_expanded',
                    ).length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Expansiones</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {result.chunkComparisons.filter(
                      (c) =>
                        c.changeType === 'obligation_shift' || c.changeType === 'sanction_changed',
                    ).length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Cambios Críticos</div>
                </div>
              </div>
            )}
          </div>

          {/* Result tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setResultTab('resumen')}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
                resultTab === 'resumen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Resumen Ejecutivo
            </button>
            <button
              onClick={() => setResultTab('cambios')}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
                resultTab === 'cambios'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Cambios Detectados
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {result.totalChanges}
              </span>
            </button>
            <button
              onClick={() => setResultTab('impacto')}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
                resultTab === 'impacto'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Análisis de Impacto
              {result.stakeholderAnalysis?.entities.length ? (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
                  {result.stakeholderAnalysis.entities.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* Tab: Resumen Ejecutivo */}
          {resultTab === 'resumen' && result.summary && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setSummaryExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-semibold text-gray-900">Resumen Ejecutivo Generado por IA</h3>
                {summaryExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {summaryExpanded && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <p className="text-gray-700 leading-relaxed mt-4 text-sm">{result.summary}</p>
                </div>
              )}
            </div>
          )}

          {resultTab === 'resumen' && !result.summary && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Resumen no disponible. Configure GROQ_API_KEY para activar esta función.
              </p>
            </div>
          )}

          {/* Tab: Cambios detectados */}
          {resultTab === 'cambios' && (
            <DiffViewerPanel
              chunks={result.chunkComparisons}
              sourceTitle={result.sourceDocument.title}
              targetTitle={result.targetDocument.title}
            />
          )}

          {/* Tab: Análisis de Impacto */}
          {resultTab === 'impacto' && result.stakeholderAnalysis && (
            <ImpactAnalysisPanel analysis={result.stakeholderAnalysis} />
          )}

          {resultTab === 'impacto' && !result.stakeholderAnalysis && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Configure GROQ_API_KEY para activar el análisis de partes interesadas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
