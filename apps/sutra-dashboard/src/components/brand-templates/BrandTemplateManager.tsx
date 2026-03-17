'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  BrandTemplate,
  getBrandTemplates,
  createBrandTemplate,
  updateBrandTemplate,
  deleteBrandTemplate,
  setDefaultTemplate,
  uploadLogo,
} from '@/lib/brand-templates-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { value: 'Calibri, sans-serif', label: 'Calibri' },
  { value: "'Courier New', Courier, monospace", label: 'Courier New' },
];

const EMPTY_FORM: Partial<BrandTemplate> = {
  name: '',
  description: '',
  header_image_url: '',
  header_html: '',
  footer_html: '',
  footer_image_url: '',
  primary_color: '#1a365d',
  secondary_color: '#2d3748',
  font_family: 'Arial, sans-serif',
  logo_position: 'left',
  is_default: false,
};

// ─── Toast component ──────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
        ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
    >
      {type === 'success' ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
  onDelete,
  onSetDefault,
}: {
  template: BrandTemplate;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md
        ${selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
    >
      {/* Default badge */}
      {template.is_default && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Predeterminada
        </div>
      )}

      {/* Color swatch */}
      <div className="flex gap-1.5 mb-3">
        <div
          className="w-5 h-5 rounded-full border border-white shadow-sm"
          style={{ background: template.primary_color }}
        />
        <div
          className="w-5 h-5 rounded-full border border-white shadow-sm"
          style={{ background: template.secondary_color }}
        />
      </div>

      {/* Logo preview */}
      {template.header_image_url && (
        <div className="mb-2 h-8 flex items-center">
          <img
            src={template.header_image_url}
            alt="Logo"
            className="h-full object-contain max-w-[80px]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      <h3 className="font-semibold text-gray-800 text-sm truncate pr-16">{template.name}</h3>
      {template.description && (
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{template.description}</p>
      )}
      <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: template.font_family }}>
        {template.font_family.split(',')[0]}
      </p>

      {/* Actions */}
      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onSelect}
          className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 transition-colors font-medium"
        >
          Editar
        </button>
        {!template.is_default && (
          <button
            onClick={onSetDefault}
            className="flex-1 text-xs px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 transition-colors font-medium"
          >
            Usar por defecto
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
          title="Eliminar"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({ form }: { form: Partial<BrandTemplate> }) {
  const logoAlignMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };
  const align = logoAlignMap[form.logo_position ?? 'left'] ?? 'flex-start';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden text-xs shadow-sm">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center"
        style={{
          background: form.primary_color ?? '#1a365d',
          borderBottom: `3px solid ${form.secondary_color ?? '#2d3748'}`,
          justifyContent: align,
        }}
      >
        {form.header_image_url ? (
          <img
            src={form.header_image_url}
            alt="Logo"
            className="max-h-10 max-w-[100px] object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : form.header_html ? (
          <div
            className="text-white"
            dangerouslySetInnerHTML={{ __html: form.header_html }}
          />
        ) : (
          <span className="text-white/60 italic">Encabezado del documento</span>
        )}
      </div>

      {/* Content */}
      <div
        className="px-4 py-4 text-gray-600"
        style={{ fontFamily: form.font_family ?? 'Arial, sans-serif' }}
      >
        <p className="font-semibold text-gray-800 mb-1" style={{ color: form.primary_color }}>
          Proyecto de Ley Num. 1234
        </p>
        <p className="leading-relaxed">
          Para enmendar la Ley Num. 38-2017, a fin de establecer nuevos
          requisitos de transparencia en la contratación gubernamental...
        </p>
        <div className="mt-2 flex gap-3">
          <span className="px-2 py-0.5 rounded text-white text-xs" style={{ background: form.secondary_color ?? '#2d3748' }}>
            Senado
          </span>
          <span className="text-gray-400">17 de marzo, 2026</span>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex items-center"
        style={{
          background: form.secondary_color ?? '#2d3748',
          borderTop: `3px solid ${form.primary_color ?? '#1a365d'}`,
          justifyContent: align,
        }}
      >
        {form.footer_image_url ? (
          <img
            src={form.footer_image_url}
            alt="Logo"
            className="max-h-8 max-w-[80px] object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : form.footer_html ? (
          <div
            className="text-white/80"
            dangerouslySetInnerHTML={{ __html: form.footer_html }}
          />
        ) : (
          <span className="text-white/60 italic">Pie de página</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrandTemplateManager() {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<Partial<BrandTemplate>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<'header' | 'footer' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const headerLogoRef = useRef<HTMLInputElement>(null);
  const footerLogoRef = useRef<HTMLInputElement>(null);

  // ── Load templates ─────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getBrandTemplates(token);
      setTemplates(data);
    } catch (e) {
      showToast('Error al cargar las plantillas', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const setField = (key: keyof BrandTemplate, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Select template for editing ────────────────────────────────────────────

  const handleSelectTemplate = (template: BrandTemplate) => {
    setSelectedId(template.id);
    setIsCreating(false);
    setForm({ ...template });
  };

  // ── Start creating new ─────────────────────────────────────────────────────

  const handleNewTemplate = () => {
    setSelectedId(null);
    setIsCreating(true);
    setForm({ ...EMPTY_FORM });
  };

  const handleCancel = () => {
    setSelectedId(null);
    setIsCreating(false);
    setForm({ ...EMPTY_FORM });
  };

  // ── Save (create or update) ────────────────────────────────────────────────

  const handleSave = async () => {
    if (!token) return;
    if (!form.name?.trim()) {
      showToast('El nombre de la plantilla es requerido', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const created = await createBrandTemplate(token, form);
        setTemplates((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setIsCreating(false);
        setForm({ ...created });
        showToast('Plantilla creada exitosamente', 'success');
      } else if (selectedId) {
        const updated = await updateBrandTemplate(token, selectedId, form);
        setTemplates((prev) =>
          prev.map((t) => (t.id === selectedId ? updated : t)),
        );
        setForm({ ...updated });
        showToast('Plantilla actualizada', 'success');
      }
    } catch (e: any) {
      showToast(e.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await deleteBrandTemplate(token, id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedId === id) handleCancel();
      showToast('Plantilla eliminada', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error al eliminar', 'error');
    }
  };

  // ── Set default ────────────────────────────────────────────────────────────

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      const updated = await setDefaultTemplate(token, id);
      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          is_default: t.id === id,
        })),
      );
      if (selectedId === id) setForm((prev) => ({ ...prev, is_default: true }));
      showToast('Plantilla predeterminada actualizada', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error', 'error');
    }
  };

  // ── Logo upload ────────────────────────────────────────────────────────────

  const handleLogoUpload = async (
    file: File,
    target: 'header' | 'footer',
  ) => {
    if (!token) return;
    setUploadingLogo(target);
    try {
      const { url } = await uploadLogo(token, file);
      const field =
        target === 'header' ? 'header_image_url' : 'footer_image_url';
      setField(field, url);
      showToast('Logo subido exitosamente', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error al subir el logo', 'error');
    } finally {
      setUploadingLogo(null);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent, target: 'header' | 'footer') => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleLogoUpload(file, target);
    },
    [token],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEditing = isCreating || selectedId !== null;

  return (
    <div className="space-y-6">
      {/* ── Template Cards Grid ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Plantillas de Documentos</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Personaliza el encabezado y pie de todos tus reportes y dossiers
            </p>
          </div>
          <button
            onClick={handleNewTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Plantilla
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando plantillas...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No tienes plantillas todavia.</p>
              <button
                onClick={handleNewTemplate}
                className="mt-3 text-sm text-blue-600 hover:underline font-medium"
              >
                Crear tu primera plantilla
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {templates.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  selected={selectedId === tpl.id}
                  onSelect={() => handleSelectTemplate(tpl)}
                  onDelete={() => handleDelete(tpl.id)}
                  onSetDefault={() => handleSetDefault(tpl.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit / Create Panel ── */}
      {isEditing && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              {isCreating ? 'Nueva Plantilla' : `Editando: ${form.name || 'Sin nombre'}`}
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ── Left: Form ── */}
            <div className="space-y-5">
              {/* Name + Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name ?? ''}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Mi Firma Legal"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Descripcion
                  </label>
                  <input
                    type="text"
                    value={form.description ?? ''}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Uso para reportes de clientes"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Header Logo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Logo del Encabezado
                </label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors relative"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, 'header')}
                  onClick={() => headerLogoRef.current?.click()}
                >
                  {form.header_image_url ? (
                    <div className="flex items-center justify-center gap-3">
                      <img
                        src={form.header_image_url}
                        alt="Header logo"
                        className="max-h-12 max-w-[120px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setField('header_image_url', ''); }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xs">
                      {uploadingLogo === 'header' ? (
                        <span>Subiendo...</span>
                      ) : (
                        <>
                          <svg className="w-6 h-6 mx-auto mb-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Arrastra tu logo aqui o haz clic para seleccionar
                          <span className="block mt-0.5 text-gray-300">PNG, JPG, SVG (max 5MB)</span>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={headerLogoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoUpload(f, 'header');
                    }}
                  />
                </div>
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={form.header_image_url ?? ''}
                    onChange={(e) => setField('header_image_url', e.target.value)}
                    placeholder="O pega una URL de imagen..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Header HTML */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  HTML del Encabezado{' '}
                  <span className="font-normal text-gray-400">(opcional — sobreescribe el logo)</span>
                </label>
                <textarea
                  value={form.header_html ?? ''}
                  onChange={(e) => setField('header_html', e.target.value)}
                  placeholder="<div style='color:white'><strong>Nombre de la Firma</strong><br/>Dirección, tel</div>"
                  rows={3}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Footer HTML */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  HTML del Pie de Pagina{' '}
                  <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={form.footer_html ?? ''}
                  onChange={(e) => setField('footer_html', e.target.value)}
                  placeholder="<span style='color:white'>Firma Legal, LLC | San Juan, PR | (787) 555-1234</span>"
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Footer Logo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Logo del Pie de Pagina
                </label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, 'footer')}
                  onClick={() => footerLogoRef.current?.click()}
                >
                  {form.footer_image_url ? (
                    <div className="flex items-center justify-center gap-3">
                      <img
                        src={form.footer_image_url}
                        alt="Footer logo"
                        className="max-h-8 max-w-[100px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setField('footer_image_url', ''); }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">
                      {uploadingLogo === 'footer' ? 'Subiendo...' : 'Arrastra o haz clic para subir logo del pie'}
                    </span>
                  )}
                  <input
                    ref={footerLogoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoUpload(f, 'footer');
                    }}
                  />
                </div>
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={form.footer_image_url ?? ''}
                    onChange={(e) => setField('footer_image_url', e.target.value)}
                    placeholder="O pega una URL de imagen..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Color Principal
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primary_color ?? '#1a365d'}
                      onChange={(e) => setField('primary_color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.primary_color ?? '#1a365d'}
                      onChange={(e) => setField('primary_color', e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Color Secundario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.secondary_color ?? '#2d3748'}
                      onChange={(e) => setField('secondary_color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.secondary_color ?? '#2d3748'}
                      onChange={(e) => setField('secondary_color', e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Font + Logo position */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Fuente del Documento
                  </label>
                  <select
                    value={form.font_family ?? 'Arial, sans-serif'}
                    onChange={(e) => setField('font_family', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: form.font_family }}
                  >
                    {FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Posicion del Logo
                  </label>
                  <div className="flex gap-2 mt-1">
                    {(['left', 'center', 'right'] as const).map((pos) => {
                      const labels: Record<string, string> = {
                        left: 'Izquierda',
                        center: 'Centro',
                        right: 'Derecha',
                      };
                      return (
                        <label
                          key={pos}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors
                            ${form.logo_position === pos
                              ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                          <input
                            type="radio"
                            name="logo_position"
                            value={pos}
                            checked={form.logo_position === pos}
                            onChange={() => setField('logo_position', pos)}
                            className="sr-only"
                          />
                          {labels[pos]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Default checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={form.is_default ?? false}
                  onChange={(e) => setField('is_default', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="is_default" className="text-sm text-gray-600 cursor-pointer">
                  Usar como plantilla predeterminada
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={handleCancel}
                  className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {saving && (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {saving ? 'Guardando...' : 'Guardar Plantilla'}
                </button>
              </div>
            </div>

            {/* ── Right: Preview ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Vista Previa en Vivo
                </h3>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <LivePreview form={form} />
              <p className="text-xs text-gray-400">
                Esta vista previa muestra como aparecera el encabezado y pie en tus documentos generados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
