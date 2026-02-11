'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const COMPARATOR_API = process.env.NEXT_PUBLIC_COMPARATOR_API || 'http://localhost:3002';

type UploadedDoc = {
  documentId: string;
  versionId: string;
  fileName: string;
  wordCount: number;
};

type ComparisonResult = {
  comparisonId: string;
  status: string;
  sourceDocument: { title: string };
  targetDocument: { title: string };
  summary?: string;
  impactScore: number;
  totalChanges: number;
  chunkComparisons: Array<{
    diffHtml: string;
    changeType?: string;
    impactScore?: number;
  }>;
};

export default function ComparatorPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');

  // Upload state
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [sourceDoc, setSourceDoc] = useState<UploadedDoc | null>(null);
  const [targetDoc, setTargetDoc] = useState<UploadedDoc | null>(null);

  // Text input state
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  // File upload handler
  const handleFileUpload = async (file: File, type: 'source' | 'target') => {
    const setUploading = type === 'source' ? setUploadingSource : setUploadingTarget;
    const setDoc = type === 'source' ? setSourceDoc : setTargetDoc;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      formData.append('autoIngest', 'true');

      const response = await fetch(`${COMPARATOR_API}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();

      setDoc({
        documentId: data.documentId,
        versionId: data.versionId,
        fileName: data.metadata.fileName,
        wordCount: data.metadata.wordCount,
      });

      // Wait for ingestion to complete
      await waitForIngestion(data.snapshotId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setDoc(null);
    } finally {
      setUploading(false);
    }
  };

  // Wait for ingestion job to complete
  const waitForIngestion = async (snapshotId: string, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const response = await fetch(`${COMPARATOR_API}/documents/queue/stats`);
        const stats = await response.json();

        if (stats.active === 0 && stats.waiting === 0) {
          return; // Processing complete
        }
      } catch (err) {
        console.error('Error checking ingestion status:', err);
      }
    }

    throw new Error('Ingestion timeout');
  };

  // Compare documents
  const handleCompare = async () => {
    setComparing(true);
    setError(null);
    setResult(null);

    try {
      let sourceVersionId: string;
      let targetVersionId: string;

      if (activeTab === 'upload') {
        if (!sourceDoc || !targetDoc) {
          throw new Error('Please upload both documents');
        }
        sourceVersionId = sourceDoc.versionId;
        targetVersionId = targetDoc.versionId;
      } else {
        // For text input, we'd need to create documents first
        // This is a simplified version
        throw new Error('Text comparison coming soon');
      }

      // Start comparison job
      const compareResponse = await fetch(`${COMPARATOR_API}/comparison/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceVersionId, targetVersionId }),
      });

      if (!compareResponse.ok) {
        throw new Error('Comparison failed');
      }

      const { jobId } = await compareResponse.json();

      // Poll for completion
      const comparisonId = await waitForComparison(jobId);

      // Get results
      const resultResponse = await fetch(`${COMPARATOR_API}/projects/${comparisonId}/summary`);

      if (!resultResponse.ok) {
        throw new Error('Failed to get results');
      }

      const resultData = await resultResponse.json();
      setResult(resultData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  // Wait for comparison job
  const waitForComparison = async (jobId: string, maxAttempts = 60): Promise<string> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(`${COMPARATOR_API}/comparison/jobs/${jobId}`);
      const data = await response.json();

      if (data.state === 'completed' && data.returnvalue) {
        return data.returnvalue.comparisonId;
      }

      if (data.state === 'failed') {
        throw new Error('Comparison job failed');
      }
    }

    throw new Error('Comparison timeout');
  };

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent, type: 'source' | 'target') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (type === 'source') {
        setSourceFile(file);
        handleFileUpload(file, 'source');
      } else {
        setTargetFile(file);
        handleFileUpload(file, 'target');
      }
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Comparador de Leyes</h1>
        <p className="text-gray-600 mt-1">Compara versiones de documentos legislativos y detecta cambios semánticos.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'upload'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="inline w-4 h-4 mr-2" />
          Subir Archivos
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'text'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="inline w-4 h-4 mr-2" />
          Pegar Texto
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Document */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Documento Original</h3>

            <div
              onDrop={(e) => handleDrop(e, 'source')}
              onDragOver={handleDragOver}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                uploadingSource
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {uploadingSource ? (
                <div className="space-y-3">
                  <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
                  <p className="text-sm text-gray-600">Procesando documento...</p>
                </div>
              ) : sourceDoc ? (
                <div className="space-y-3">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <div>
                    <p className="font-medium text-gray-900">{sourceDoc.fileName}</p>
                    <p className="text-sm text-gray-500">{sourceDoc.wordCount.toLocaleString()} palabras</p>
                  </div>
                  <button
                    onClick={() => {
                      setSourceFile(null);
                      setSourceDoc(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
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
                      if (file) {
                        setSourceFile(file);
                        handleFileUpload(file, 'source');
                      }
                    }}
                    className="hidden"
                    id="source-file"
                  />
                  <label
                    htmlFor="source-file"
                    className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer"
                  >
                    Seleccionar Archivo
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Target Document */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Documento Nuevo</h3>

            <div
              onDrop={(e) => handleDrop(e, 'target')}
              onDragOver={handleDragOver}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                uploadingTarget
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {uploadingTarget ? (
                <div className="space-y-3">
                  <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
                  <p className="text-sm text-gray-600">Procesando documento...</p>
                </div>
              ) : targetDoc ? (
                <div className="space-y-3">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <div>
                    <p className="font-medium text-gray-900">{targetDoc.fileName}</p>
                    <p className="text-sm text-gray-500">{targetDoc.wordCount.toLocaleString()} palabras</p>
                  </div>
                  <button
                    onClick={() => {
                      setTargetFile(null);
                      setTargetDoc(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
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
                      if (file) {
                        setTargetFile(file);
                        handleFileUpload(file, 'target');
                      }
                    }}
                    className="hidden"
                    id="target-file"
                  />
                  <label
                    htmlFor="target-file"
                    className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer"
                  >
                    Seleccionar Archivo
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Text Tab */}
      {activeTab === 'text' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Texto Original</h3>
            <textarea
              className="w-full h-80 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Pega el texto original aquí..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Texto Nuevo</h3>
            <textarea
              className="w-full h-80 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Pega el texto nuevo aquí..."
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Compare Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={
            comparing ||
            (activeTab === 'upload' && (!sourceDoc || !targetDoc)) ||
            (activeTab === 'text' && (!sourceText || !targetText))
          }
          className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
            comparing ||
            (activeTab === 'upload' && (!sourceDoc || !targetDoc)) ||
            (activeTab === 'text' && (!sourceText || !targetText))
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg'
          }`}
        >
          {comparing ? (
            <>
              <Loader2 className="inline w-5 h-5 mr-2 animate-spin" />
              Comparando Documentos...
            </>
          ) : (
            'Comparar Documentos'
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Resumen de Comparación</h2>
                <p className="text-gray-600 mt-1">
                  {result.sourceDocument.title} → {result.targetDocument.title}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">{result.impactScore}</div>
                <div className="text-sm text-gray-600">Impact Score</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{result.totalChanges}</div>
                <div className="text-sm text-gray-600">Total de Cambios</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {result.chunkComparisons.filter(c => c.changeType === 'scope_expansion').length}
                </div>
                <div className="text-sm text-gray-600">Expansiones</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {result.chunkComparisons.filter(c => c.changeType === 'obligation_shift').length}
                </div>
                <div className="text-sm text-gray-600">Cambios Críticos</div>
              </div>
            </div>

            {result.summary && (
              <div className="mt-4 p-4 bg-white rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Resumen Ejecutivo</h3>
                <p className="text-gray-700">{result.summary}</p>
              </div>
            )}
          </div>

          {/* Diff View */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Cambios Detectados</h3>
              <p className="text-sm text-gray-600 mt-1">Cambios resaltados por chunk</p>
            </div>

            <div className="divide-y divide-gray-200">
              {result.chunkComparisons.slice(0, 10).map((chunk, idx) => (
                <div key={idx} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Chunk #{idx + 1}</span>
                      {chunk.changeType && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          chunk.changeType === 'obligation_shift'
                            ? 'bg-red-100 text-red-700'
                            : chunk.changeType === 'scope_expansion'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {chunk.changeType.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {chunk.impactScore !== undefined && (
                      <span className="text-sm font-medium text-gray-600">
                        Impact: {(chunk.impactScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: chunk.diffHtml }}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      lineHeight: '1.6',
                    }}
                  />
                </div>
              ))}
            </div>

            {result.chunkComparisons.length > 10 && (
              <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
                Mostrando 10 de {result.chunkComparisons.length} cambios.
                Exporta el reporte para ver todos.
              </div>
            )}
          </div>

          {/* Export Button */}
          <div className="flex justify-center">
            <button
              onClick={async () => {
                const response = await fetch(`${COMPARATOR_API}/projects/${result.comparisonId}/export`);
                const data = await response.json();
                alert(data.message);
              }}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Exportar Reporte PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
