'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderOpen, FileText, Calendar, Scale, Trash2 } from 'lucide-react';
import { getProjects, createProject, deleteProject } from '@/lib/api';
import { useDossier, DossierProject } from '@/context/DossierContext';

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { setActiveProject } = useDossier();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [measureRef, setMeasureRef] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => createProject({ name, description: description || undefined, measure_reference: measureRef || undefined }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setActiveProject(project);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Error al crear el proyecto. Verifica que el servidor esté corriendo.');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-[#1e293b] mb-4">Nuevo Proyecto de Dossier</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#64748b] block mb-1">Nombre del proyecto *</label>
            <input
              className="w-full bg-[#F5F6FA] border border-[#e2e8f0] rounded px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:border-[#4F7CFF]"
              placeholder="Ej: Análisis PS 1234 — Energía Renovable"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
            />
          </div>
          <div>
            <label className="text-xs text-[#64748b] block mb-1">Medida de referencia</label>
            <input
              className="w-full bg-[#F5F6FA] border border-[#e2e8f0] rounded px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:border-[#4F7CFF]"
              placeholder="Ej: PS 1234, RC 567"
              value={measureRef}
              onChange={(e) => setMeasureRef(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-[#64748b] block mb-1">Descripción</label>
            <textarea
              className="w-full bg-[#F5F6FA] border border-[#e2e8f0] rounded px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:border-[#4F7CFF] resize-none"
              rows={3}
              placeholder="Descripción del proyecto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="flex-1 bg-[#3B69EB] hover:bg-[#4F7CFF] disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            {mutation.isPending ? 'Creando...' : 'Crear Proyecto'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#64748b] hover:text-[#1e293b] transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ project, onConfirm, onCancel, isPending }: {
  project: DossierProject;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[#1e293b] mb-2">Eliminar proyecto</h2>
        <p className="text-sm text-[#64748b] mb-4">
          ¿Seguro que quieres eliminar <span className="font-medium text-[#1e293b]">&ldquo;{project.name}&rdquo;</span>?
          Se borrarán todos sus documentos y conversaciones. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            {isPending ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm text-[#64748b] hover:text-[#1e293b] transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSelector() {
  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  const { setActiveProject } = useDossier();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DossierProject | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="w-7 h-7 text-[#4F7CFF]" />
        <h1 className="text-2xl font-bold text-[#1e293b]">LW Dossier</h1>
      </div>
      <p className="text-[#64748b] text-sm mb-6">Sala de Guerra Documental · Motor de Advocacy</p>

      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-[#3B69EB] hover:bg-[#4F7CFF] text-white rounded-lg px-6 py-3 flex items-center justify-center gap-2 font-medium transition-colors mb-6"
      >
        <Plus className="w-5 h-5" />
        Nuevo Proyecto de Dossier
      </button>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-[#e2e8f0] rounded w-2/3 mb-2" />
              <div className="h-3 bg-[#e2e8f0] rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {projects && projects.length > 0 && (
        <div>
          <p className="text-xs text-[#64748b] mb-2">Proyectos recientes ({projects.length})</p>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <button
                onClick={() => setActiveProject(project)}
                className="w-full bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] hover:border-[#4F7CFF]/50 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <FolderOpen className="w-5 h-5 text-[#4F7CFF] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1 pr-8">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1e293b] truncate">{project.name}</span>
                      {project.measure_reference && (
                        <span className="text-xs bg-[#4F7CFF]/20 text-[#4F7CFF] px-2 py-0.5 rounded-full border border-[#4F7CFF]/30 flex-shrink-0">
                          {project.measure_reference}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs font-medium text-[#475569]">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {project.documents?.length ?? 0} docs
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(project.updated_at).toLocaleDateString('es-PR')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(project); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-all"
                title="Eliminar proyecto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      {projects?.length === 0 && !isLoading && (
        <div className="text-center text-[#64748b] text-sm py-8">
          No hay proyectos aún. Crea uno para comenzar.
        </div>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} />}
      {confirmDelete && (
        <DeleteConfirmModal
          project={confirmDelete}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
