'use client';
import { useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Plus, FileText, FileType2, File, Loader2, CheckCircle2,
  XCircle, Upload, Trash2, Edit2,
} from 'lucide-react';
import { useDossier } from '@/context/DossierContext';
import { getDocuments, uploadDocument, deleteDocument } from '@/lib/api';
import type { DossierDocument } from '@/context/DossierContext';

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileType2 className="w-4 h-4 text-red-400" />;
  if (mimeType.includes('word') || mimeType.includes('docx')) return <FileText className="w-4 h-4 text-blue-400" />;
  return <File className="w-4 h-4 text-[#64748b]" />;
}

function StatusIcon({ status }: { status: DossierDocument['processing_status'] }) {
  if (status === 'pending' || status === 'processing')
    return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />;
  if (status === 'completed')
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
}

export default function LeftPanel() {
  const { activeProject, setActiveProject } = useDossier();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', activeProject?.id],
    queryFn: () => getDocuments(activeProject!.id),
    enabled: !!activeProject,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs) return false;
      const hasProcessing = docs.some((d) => d.processing_status === 'pending' || d.processing_status === 'processing');
      return hasProcessing ? 3000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(activeProject!.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', activeProject?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ docId }: { docId: string }) => deleteDocument(activeProject!.id, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', activeProject?.id] }),
  });

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (!activeProject) return null;

  return (
    <div
      className="panel-left h-full bg-white border-r border-[#e2e8f0] flex flex-col overflow-hidden shadow-md"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-3 border-b border-[#e2e8f0]">
        <button
          onClick={() => setActiveProject(null)}
          className="flex items-center gap-1 text-xs text-[#475569] font-medium hover:text-[#1e293b] mb-2 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> Proyectos
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm text-[#1e293b] truncate">{activeProject.name}</h2>
            {activeProject.measure_reference && (
              <span className="text-xs text-[#4F7CFF]">{activeProject.measure_reference}</span>
            )}
          </div>
          <button className="text-[#64748b] hover:text-[#1e293b] flex-shrink-0">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Docs header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#e2e8f0]">
        <span className="text-xs font-bold text-[#334155] uppercase tracking-wider">Documentos</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs text-[#4F7CFF] hover:text-[#6B8FF8] transition-colors"
          disabled={uploadMutation.isPending}
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-[#e2e8f0] rounded animate-pulse" />
            ))}
          </div>
        )}

        {documents?.length === 0 && !isLoading && (
          <div className="p-4 text-center">
            <Upload className="w-8 h-8 text-[#e2e8f0] mx-auto mb-2" />
            <p className="text-xs text-[#475569] font-medium">Arrastra archivos aquí o usa el botón Agregar</p>
            <p className="text-xs text-[#64748b] mt-1">PDF, DOCX, TXT</p>
          </div>
        )}

        {documents?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start gap-2 px-3 py-2.5 hover:bg-[#f1f5f9] group cursor-pointer border-b border-[#e2e8f0]"
          >
            <div className="mt-0.5 flex-shrink-0">{getFileIcon(doc.mime_type)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1e293b] truncate">{doc.file_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusIcon status={doc.processing_status} />
                <span className="text-xs font-medium text-[#475569]">
                  {doc.processing_status === 'completed' && `${doc.chunk_count} fragmentos`}
                  {doc.processing_status === 'processing' && 'Procesando...'}
                  {doc.processing_status === 'pending' && 'En cola'}
                  {doc.processing_status === 'error' && 'Error'}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ docId: doc.id }); }}
              className="opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Drop zone hint */}
      <div className="p-3 border-t border-[#e2e8f0]">
        <p className="text-xs text-[#64748b] font-medium text-center">Arrastra archivos para subir</p>
      </div>
    </div>
  );
}
