'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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

const MONITOR_URL = process.env.NEXT_PUBLIC_MONITOR_URL || 'http://localhost:3001';

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

type Mode = 'list' | 'create-choose' | 'create-ai' | 'create-manual' | 'edit';
type HeaderFooterInputType = 'image' | 'url' | 'html';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
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

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
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
          <span
            className="px-2 py-0.5 rounded text-white text-xs"
            style={{ background: form.secondary_color ?? '#2d3748' }}
          >
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

// ─── Header/Footer Input Block ────────────────────────────────────────────────

function HeaderFooterBlock({
  label,
  inputType,
  onInputTypeChange,
  imageUrl,
  onImageUrlChange,
  html,
  onHtmlChange,
  onFileUpload,
  uploading,
  placeholder,
  htmlPlaceholder,
}: {
  label: string;
  inputType: HeaderFooterInputType;
  onInputTypeChange: (t: HeaderFooterInputType) => void;
  imageUrl: string;
  onImageUrlChange: (v: string) => void;
  html: string;
  onHtmlChange: (v: string) => void;
  onFileUpload: (f: File) => void;
  uploading: boolean;
  placeholder: string;
  htmlPlaceholder: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>

      {/* Type selector */}
      <div className="flex gap-2">
        {(['image', 'url', 'html'] as HeaderFooterInputType[]).map((t) => {
          const labels: Record<HeaderFooterInputType, string> = {
            image: 'Imagen',
            url: 'URL',
            html: 'HTML personalizado',
          };
          return (
            <label
              key={t}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors
                ${inputType === t
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
            >
              <input
                type="radio"
                name={`hf-type-${label}`}
                value={t}
                checked={inputType === t}
                onChange={() => onInputTypeChange(t)}
                className="sr-only"
              />
              {labels[t]}
            </label>
          );
        })}
      </div>

      {/* Image upload */}
      {inputType === 'image' && (
        <div
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors
            ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) onFileUpload(file);
          }}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
              <Spinner />
              Subiendo...
            </div>
          ) : imageUrl ? (
            <div className="flex items-center justify-center gap-3">
              <img
                src={imageUrl}
                alt="preview"
                className="max-h-12 max-w-[120px] object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onImageUrlChange(''); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Quitar
              </button>
            </div>
          ) : (
            <div className="text-gray-400 text-xs space-y-1">
              <svg className="w-6 h-6 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Arrastra tu imagen aquí o <span className="text-blue-600">haz clic</span></p>
              <p className="text-gray-300">PNG, JPG, SVG (max 5MB)</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileUpload(f);
            }}
          />
        </div>
      )}

      {/* URL input */}
      {inputType === 'url' && (
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => onImageUrlChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {/* HTML textarea */}
      {inputType === 'html' && (
        <textarea
          value={html}
          onChange={(e) => onHtmlChange(e.target.value)}
          placeholder={htmlPlaceholder}
          rows={3}
          className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  template: BrandTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all hover:border-blue-200 group">
      {/* Default badge */}
      {template.is_default && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Por defecto
        </div>
      )}

      {/* Color swatches */}
      <div className="flex gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200"
          style={{ background: template.primary_color }}
          title={`Principal: ${template.primary_color}`}
        />
        <div
          className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200"
          style={{ background: template.secondary_color }}
          title={`Secundario: ${template.secondary_color}`}
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
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
      )}
      <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: template.font_family }}>
        {template.font_family.split(',')[0]}
      </p>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 transition-colors font-medium"
        >
          Editar
        </button>
        {!template.is_default && (
          <button
            onClick={onSetDefault}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 transition-colors font-medium"
          >
            Usar por defecto
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
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

// ─── Design Form (shared between manual and AI review) ────────────────────────

function DesignForm({
  form,
  setField,
  headerInputType,
  setHeaderInputType,
  footerInputType,
  setFooterInputType,
  uploading,
  onHeaderFileUpload,
  onFooterFileUpload,
  showPreview,
  onTogglePreview,
  onCancel,
  onSave,
  saving,
  title,
}: {
  form: Partial<BrandTemplate>;
  setField: (k: keyof BrandTemplate, v: any) => void;
  headerInputType: HeaderFooterInputType;
  setHeaderInputType: (t: HeaderFooterInputType) => void;
  footerInputType: HeaderFooterInputType;
  setFooterInputType: (t: HeaderFooterInputType) => void;
  uploading: 'header' | 'footer' | null;
  onHeaderFileUpload: (f: File) => void;
  onFooterFileUpload: (f: File) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  title: string;
}) {
  return (
    <div className="space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <button
          onClick={onTogglePreview}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors
            ${showPreview
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Vista Previa
        </button>
      </div>

      <div className={`grid gap-8 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>
        {/* Form column */}
        <div className="space-y-6">
          {/* Header block */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Encabezado (Header)</p>
            <HeaderFooterBlock
              label=""
              inputType={headerInputType}
              onInputTypeChange={setHeaderInputType}
              imageUrl={form.header_image_url ?? ''}
              onImageUrlChange={(v) => setField('header_image_url', v)}
              html={form.header_html ?? ''}
              onHtmlChange={(v) => setField('header_html', v)}
              onFileUpload={onHeaderFileUpload}
              uploading={uploading === 'header'}
              placeholder="https://mi-empresa.com/logo.png"
              htmlPlaceholder="<div style='color:white'><strong>Nombre de la Firma</strong><br/>Dirección, tel</div>"
            />
          </div>

          {/* Footer block */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pie de Página (Footer)</p>
            <HeaderFooterBlock
              label=""
              inputType={footerInputType}
              onInputTypeChange={setFooterInputType}
              imageUrl={form.footer_image_url ?? ''}
              onImageUrlChange={(v) => setField('footer_image_url', v)}
              html={form.footer_html ?? ''}
              onHtmlChange={(v) => setField('footer_html', v)}
              onFileUpload={onFooterFileUpload}
              uploading={uploading === 'footer'}
              placeholder="https://mi-empresa.com/footer-logo.png"
              htmlPlaceholder="<span style='color:white'>Firma Legal, LLC | San Juan, PR | (787) 555-1234</span>"
            />
          </div>

          {/* Colors */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estilo</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Color Principal</label>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Color Secundario</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fuente</label>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Posición del Logo</label>
                <div className="flex gap-2 mt-1">
                  {(['left', 'center', 'right'] as const).map((pos) => {
                    const labels: Record<string, string> = {
                      left: 'Izq',
                      center: 'Centro',
                      right: 'Der',
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
          </div>

          {/* Default checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wizard_is_default"
              checked={form.is_default ?? false}
              onChange={(e) => setField('is_default', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="wizard_is_default" className="text-sm text-gray-600 cursor-pointer">
              Usar como plantilla predeterminada
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={onCancel}
              className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving && <Spinner />}
              {saving ? 'Guardando...' : 'Guardar Plantilla'}
            </button>
          </div>
        </div>

        {/* Preview column */}
        {showPreview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vista Previa en Vivo</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <LivePreview form={form} />
            <p className="text-xs text-gray-400">
              Esta vista previa muestra cómo aparecerá el encabezado y pie en tus documentos generados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

export default function BrandTemplateWizard() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [mode, setMode] = useState<Mode>('list');
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Wizard step 1 fields
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  // Edit/create form
  const [form, setFormState] = useState<Partial<BrandTemplate>>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Header/footer type toggles
  const [headerInputType, setHeaderInputType] = useState<HeaderFooterInputType>('url');
  const [footerInputType, setFooterInputType] = useState<HeaderFooterInputType>('html');

  // Logo uploading
  const [uploading, setUploading] = useState<'header' | 'footer' | null>(null);

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);

  // AI mode
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiDragging, setAiDragging] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getBrandTemplates(token);
      setTemplates(data);
    } catch {
      showToast('Error al cargar las plantillas', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showToast = (message: string, type: 'success' | 'error') =>
    setToast({ message, type });

  const setField = (key: keyof BrandTemplate, value: any) =>
    setFormState((prev) => ({ ...prev, [key]: value }));

  const resetWizard = () => {
    setDraftName('');
    setDraftDescription('');
    setFormState({ ...EMPTY_FORM });
    setEditingId(null);
    setHeaderInputType('url');
    setFooterInputType('html');
    setShowPreview(false);
    setAiFile(null);
    setAiAnalyzing(false);
  };

  const goList = () => {
    resetWizard();
    setMode('list');
  };

  // ── Logo upload ────────────────────────────────────────────────────────────

  const handleLogoUpload = async (file: File, target: 'header' | 'footer') => {
    if (!token) return;
    setUploading(target);
    try {
      const { url } = await uploadLogo(token, file);
      setField(target === 'header' ? 'header_image_url' : 'footer_image_url', url);
      showToast('Imagen subida exitosamente', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error al subir la imagen', 'error');
    } finally {
      setUploading(null);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!token) return;
    if (!form.name?.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateBrandTemplate(token, editingId, form);
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        showToast('Plantilla actualizada', 'success');
      } else {
        const created = await createBrandTemplate(token, form);
        setTemplates((prev) => [created, ...prev]);
        showToast('Plantilla creada exitosamente', 'success');
      }
      goList();
    } catch (e: any) {
      showToast(e.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) return;
    try {
      await deleteBrandTemplate(token, id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showToast('Plantilla eliminada', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error al eliminar', 'error');
    }
  };

  // ── Set default ───────────────────────────────────────────────────────────

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      await setDefaultTemplate(token, id);
      setTemplates((prev) => prev.map((t) => ({ ...t, is_default: t.id === id })));
      showToast('Plantilla predeterminada actualizada', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error', 'error');
    }
  };

  // ── Edit existing ─────────────────────────────────────────────────────────

  const handleEdit = (tpl: BrandTemplate) => {
    setFormState({ ...tpl });
    setEditingId(tpl.id);
    // Infer input types from saved data
    setHeaderInputType(tpl.header_html ? 'html' : tpl.header_image_url ? 'url' : 'url');
    setFooterInputType(tpl.footer_html ? 'html' : tpl.footer_image_url ? 'url' : 'html');
    setMode('edit');
  };

  // ── Step 1 → choose method ────────────────────────────────────────────────

  const handleChooseAI = () => {
    setFormState({ ...EMPTY_FORM, name: draftName, description: draftDescription });
    setMode('create-ai');
  };

  const handleChooseManual = () => {
    setFormState({ ...EMPTY_FORM, name: draftName, description: draftDescription });
    setMode('create-manual');
  };

  // ── AI analysis ───────────────────────────────────────────────────────────

  const handleAnalyzeWithAI = async () => {
    if (!aiFile || !token) return;
    setAiAnalyzing(true);
    try {
      let result: Partial<BrandTemplate>;

      const formData = new FormData();
      formData.append('file', aiFile);

      const response = await fetch(`${MONITOR_URL}/api/brand-templates/analyze-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        result = await response.json();
      } else {
        // Mock fallback if endpoint not available
        result = {
          primary_color: '#1a365d',
          secondary_color: '#2d3748',
          font_family: 'Arial, sans-serif',
          header_html: '<div style="color:white;font-weight:bold">Plantilla generada por IA</div>',
          footer_html: '<div style="color:white;font-size:11px">Footer generado por IA</div>',
        };
      }

      setFormState((prev) => ({
        ...prev,
        ...result,
        name: draftName,
        description: draftDescription,
      }));
      setHeaderInputType(result.header_html ? 'html' : result.header_image_url ? 'url' : 'html');
      setFooterInputType(result.footer_html ? 'html' : result.footer_image_url ? 'url' : 'html');
      setMode('create-manual'); // reuse the same design form in review mode
      showToast('Documento analizado. Revisa y ajusta los datos.', 'success');
    } catch {
      showToast('Error al analizar el documento. Ajusta los valores manualmente.', 'error');
      setFormState((prev) => ({ ...prev, name: draftName, description: draftDescription }));
      setMode('create-manual');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // ── LIST VIEW ────────────────────────────────────────────────────────────

  if (mode === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Plantillas de Documentos</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Define el encabezado y pie de página de tus reportes y dossiers
            </p>
          </div>
          <button
            onClick={() => setMode('create-choose')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Plantilla
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <Spinner />
            Cargando plantillas...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-1">Aún no tienes plantillas</p>
            <p className="text-sm text-gray-400 mb-4">
              Crea tu primera plantilla con tu logo e identidad visual
            </p>
            <button
              onClick={() => setMode('create-choose')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear primera plantilla
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onEdit={() => handleEdit(tpl)}
                onDelete={() => handleDelete(tpl.id)}
                onSetDefault={() => handleSetDefault(tpl.id)}
              />
            ))}
          </div>
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── CREATION CHOICE (step 1) ──────────────────────────────────────────────

  if (mode === 'create-choose') {
    const canProceed = draftName.trim().length > 0;

    return (
      <div className="max-w-2xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={goList} className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nueva Plantilla</span>
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Paso 1 de 2</span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-800">Dale un nombre a tu plantilla</h2>
          <p className="text-sm text-gray-500 mt-1">Luego elige cómo quieres crearla</p>
        </div>

        {/* Name + description */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Ej: Mi Firma Legal, Cliente ABC..."
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Descripción <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder='Ej: "Uso para reportes de clientes"'
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Choice cards */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">¿Cómo quieres crear la plantilla?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* AI card */}
            <button
              onClick={handleChooseAI}
              disabled={!canProceed}
              className={`text-left p-5 rounded-2xl border-2 transition-all space-y-3
                ${canProceed
                  ? 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-blue-500 rounded-xl flex items-center justify-center text-white text-lg">
                ✨
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Con IA</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Sube un PDF, imagen o documento con tu logo y membrete. La IA extrae tu identidad visual automáticamente.
                </p>
              </div>
              <span className="inline-block text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                Recomendado
              </span>
            </button>

            {/* Manual card */}
            <button
              onClick={handleChooseManual}
              disabled={!canProceed}
              className={`text-left p-5 rounded-2xl border-2 transition-all space-y-3
                ${canProceed
                  ? 'border-gray-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
            >
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 text-lg">
                ✏️
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Manual</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Diseña el encabezado y pie de página tú mismo con imágenes, URLs o HTML personalizado.
                </p>
              </div>
            </button>
          </div>

          {!canProceed && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Ingresa un nombre antes de continuar
            </p>
          )}
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── AI CREATION ───────────────────────────────────────────────────────────

  if (mode === 'create-ai') {
    return (
      <div className="max-w-xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => setMode('create-choose')}
            className="hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">Creación con IA</span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-800">Sube tu membrete o documento</h2>
          <p className="text-sm text-gray-500 mt-1">
            La IA analizará tu documento y extraerá tu identidad visual
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer
            ${aiDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}
          onDragOver={(e) => { e.preventDefault(); setAiDragging(true); }}
          onDragLeave={() => setAiDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setAiDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) setAiFile(file);
          }}
          onClick={() => aiFileRef.current?.click()}
        >
          {aiFile ? (
            <div className="space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">{aiFile.name}</p>
              <p className="text-xs text-gray-500">{(aiFile.size / 1024).toFixed(1)} KB</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAiFile(null); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Quitar archivo
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-gray-400">
              <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-600">Arrastra tu archivo aquí</p>
              <p className="text-xs">PDF · Imagen (PNG/JPG) · Word</p>
              <button
                type="button"
                className="mt-2 text-sm text-blue-600 font-medium hover:underline"
                onClick={(e) => { e.stopPropagation(); aiFileRef.current?.click(); }}
              >
                Seleccionar archivo
              </button>
            </div>
          )}
          <input
            ref={aiFileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.docx,.doc"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAiFile(f);
            }}
          />
        </div>

        {/* What AI extracts */}
        <div className="bg-violet-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">La IA extraerá:</p>
          {[
            'Tu logo e identidad visual',
            'Colores de tu marca',
            'Información de contacto del footer',
            'Tipografía detectada',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-violet-800">
              <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => setMode('create-choose')}
            className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAnalyzeWithAI}
            disabled={!aiFile || aiAnalyzing}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            {aiAnalyzing ? (
              <>
                <Spinner />
                Analizando tu documento...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Analizar con IA
              </>
            )}
          </button>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── MANUAL CREATION / EDIT ────────────────────────────────────────────────

  if (mode === 'create-manual' || mode === 'edit') {
    const isEdit = mode === 'edit';
    const title = isEdit
      ? `Editando: ${form.name || 'Plantilla'}`
      : 'Diseño Manual';

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={isEdit ? goList : () => setMode('create-choose')}
            className="hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">{title}</span>
          {!isEdit && (
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Paso 2 de 2</span>
          )}
        </div>

        {/* Name/description (editable in this step too, for full flexibility) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name ?? ''}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Mi Firma Legal"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Uso para reportes de clientes"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <DesignForm
          form={form}
          setField={setField}
          headerInputType={headerInputType}
          setHeaderInputType={setHeaderInputType}
          footerInputType={footerInputType}
          setFooterInputType={setFooterInputType}
          uploading={uploading}
          onHeaderFileUpload={(f) => handleLogoUpload(f, 'header')}
          onFooterFileUpload={(f) => handleLogoUpload(f, 'footer')}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview((p) => !p)}
          onCancel={goList}
          onSave={handleSave}
          saving={saving}
          title=""
        />

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return null;
}
