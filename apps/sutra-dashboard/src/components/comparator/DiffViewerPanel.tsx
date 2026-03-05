'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Columns, AlignJustify, ChevronDown, ChevronUp } from 'lucide-react';

interface ChunkComparison {
  sourceChunkId: string;
  targetChunkId: string;
  label?: string;
  diffHtml: string;
  sourceSideHtml?: string;
  targetSideHtml?: string;
  changeType?: string;
  impactScore?: number;
}

interface DiffViewerPanelProps {
  chunks: ChunkComparison[];
  sourceTitle: string;
  targetTitle: string;
}

type ViewMode = 'redline' | 'side-by-side';

const CHANGE_TYPE_LABELS: Record<string, string> = {
  obligation_shift: 'Cambio de Obligación',
  scope_expansion: 'Expansión de Alcance',
  scope_expanded: 'Expansión de Alcance',
  scope_reduced: 'Reducción de Alcance',
  sanction_changed: 'Sanción Modificada',
  definition_modified: 'Definición Modificada',
  requirement_added: 'Requisito Añadido',
  requirement_removed: 'Requisito Eliminado',
  deadline_changed: 'Plazo Modificado',
  no_semantic_change: 'Sin Cambio Semántico',
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  obligation_shift: 'bg-red-100 text-red-700 border-red-200',
  scope_expansion: 'bg-green-100 text-green-700 border-green-200',
  scope_expanded: 'bg-green-100 text-green-700 border-green-200',
  scope_reduced: 'bg-orange-100 text-orange-700 border-orange-200',
  sanction_changed: 'bg-red-100 text-red-700 border-red-200',
  definition_modified: 'bg-blue-100 text-blue-700 border-blue-200',
  requirement_added: 'bg-purple-100 text-purple-700 border-purple-200',
  requirement_removed: 'bg-red-100 text-red-700 border-red-200',
  deadline_changed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  no_semantic_change: 'bg-gray-100 text-gray-600 border-gray-200',
};

function highlightSearchTerm(html: string, term: string): string {
  if (!term.trim()) return html;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return html.replace(regex, '<mark class="search-highlight">$1</mark>');
}

export function DiffViewerPanel({ chunks, sourceTitle, targetTitle }: DiffViewerPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('redline');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(() => new Set(chunks.map((_, i) => i)));
  const [showAll, setShowAll] = useState(false);

  const sourceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const targetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const syncingSource = useRef(false);
  const syncingTarget = useRef(false);

  const VISIBLE_COUNT = 10;
  const visibleChunks = showAll ? chunks : chunks.slice(0, VISIBLE_COUNT);

  // Synchronized scrolling between source and target panels
  const handleSourceScroll = useCallback((idx: number) => {
    if (syncingTarget.current) return;
    const source = sourceRefs.current[idx];
    const target = targetRefs.current[idx];
    if (source && target) {
      syncingSource.current = true;
      target.scrollTop = source.scrollTop;
      setTimeout(() => { syncingSource.current = false; }, 50);
    }
  }, []);

  const handleTargetScroll = useCallback((idx: number) => {
    if (syncingSource.current) return;
    const source = sourceRefs.current[idx];
    const target = targetRefs.current[idx];
    if (source && target) {
      syncingTarget.current = true;
      source.scrollTop = target.scrollTop;
      setTimeout(() => { syncingTarget.current = false; }, 50);
    }
  }, []);

  const toggleChunk = (idx: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getProcessedHtml = (html: string) => highlightSearchTerm(html, searchTerm);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 flex-shrink-0">Cambios Detectados</h3>

        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Search bar */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar en ambas versiones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white">
            <button
              onClick={() => setViewMode('redline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'redline'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="Vista Redline (unificada)"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Redline
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="Vista comparativa (lado a lado)"
            >
              <Columns className="w-3.5 h-3.5" />
              Lado a Lado
            </button>
          </div>
        </div>
      </div>

      {/* Diff styles — overrides diff2html default colors + legacy ins/del support */}
      <style>{`
        /* ── diff2html line-level classes ── */
        .diff-content .d2h-wrapper {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
        }
        .diff-content .d2h-file-header { display: none; }
        .diff-content .d2h-diff-table  { width: 100%; border-collapse: collapse; }
        .diff-content td, .diff-content th { padding: 2px 8px; vertical-align: top; }

        /* Added lines */
        .diff-content td.d2h-ins,
        .diff-content .d2h-code-linenumber.d2h-ins {
          background-color: #e6ffed;
          color: #24292e;
        }
        /* Deleted lines */
        .diff-content td.d2h-del,
        .diff-content .d2h-code-linenumber.d2h-del {
          background-color: #ffeef0;
          color: #24292e;
        }
        /* Context / unchanged lines */
        .diff-content td.d2h-cntx,
        .diff-content .d2h-code-linenumber.d2h-cntx {
          background-color: #fffbdd;
          color: #24292e;
        }
        /* Inline word-level highlights within lines */
        .diff-content .d2h-ins .d2h-code-line-ctn ins,
        .diff-content .d2h-ins ins {
          background-color: #acf2bd;
          text-decoration: none;
        }
        .diff-content .d2h-del .d2h-code-line-ctn del,
        .diff-content .d2h-del del {
          background-color: #fdb8c0;
          text-decoration: line-through;
        }
        /* Hunk header */
        .diff-content .d2h-info,
        .diff-content .d2h-code-linenumber.d2h-info {
          background-color: #f1f8ff;
          color: #6a737d;
        }
        /* Line number column */
        .diff-content .d2h-code-linenumber {
          width: 40px;
          min-width: 40px;
          color: #999;
          text-align: right;
          user-select: none;
          border-right: 1px solid #e1e4e8;
        }

        /* ── Fallback: legacy diff-match-patch ins/del tags ── */
        .diff-content ins, .diff-content-new ins {
          background-color: #e6ffed;
          color: #24292e;
          text-decoration: none;
          border-radius: 2px;
          padding: 0 1px;
        }
        .diff-content del, .diff-content-old del {
          background-color: #ffeef0;
          color: #24292e;
          text-decoration: line-through;
          border-radius: 2px;
          padding: 0 1px;
        }

        /* ── Search highlight ── */
        mark.search-highlight {
          background-color: #fef08a;
          color: #713f12;
          border-radius: 2px;
          padding: 0 1px;
        }

        .diff-scroll-pane {
          max-height: 480px;
          overflow-y: auto;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.7;
        }
        /* Legacy plain-text diffs (fallback) still need pre-wrap + padding */
        .diff-scroll-pane > span,
        .diff-scroll-pane > ins,
        .diff-scroll-pane > del {
          display: block;
          white-space: pre-wrap;
          word-break: break-word;
          padding: 12px;
        }
        /* diff2html wrapper inside diff-content should stretch full width */
        .diff-content .d2h-wrapper { overflow-x: auto; }
      `}</style>

      {/* Side-by-side header */}
      {viewMode === 'side-by-side' && (
        <div className="grid grid-cols-2 border-b border-gray-200">
          <div className="px-4 py-2 bg-red-50 border-r border-gray-200">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
              Ley Vigente — {sourceTitle}
            </span>
          </div>
          <div className="px-4 py-2 bg-green-50">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Propuesta — {targetTitle}
            </span>
          </div>
        </div>
      )}

      {/* Chunks */}
      <div className="divide-y divide-gray-100">
        {visibleChunks.map((chunk, idx) => {
          const isExpanded = expandedChunks.has(idx);
          const label = chunk.label ?? `Sección ${idx + 1}`;
          const changeLabel = chunk.changeType ? CHANGE_TYPE_LABELS[chunk.changeType] ?? chunk.changeType : null;
          const changeColor = chunk.changeType ? CHANGE_TYPE_COLORS[chunk.changeType] ?? 'bg-gray-100 text-gray-600 border-gray-200' : null;

          return (
            <div key={idx} className="group">
              {/* Chunk header */}
              <button
                onClick={() => toggleChunk(idx)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm text-gray-800 truncate">{label}</span>
                  {changeLabel && changeColor && (
                    <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border ${changeColor}`}>
                      {changeLabel}
                    </span>
                  )}
                  {chunk.impactScore !== undefined && (
                    <span className="flex-shrink-0 text-xs text-gray-500">
                      Impacto: {(chunk.impactScore).toFixed(0)}%
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {/* Chunk content */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {viewMode === 'redline' ? (
                    <div
                      className="diff-content diff-scroll-pane"
                      dangerouslySetInnerHTML={{
                        __html: getProcessedHtml(chunk.diffHtml),
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-2 divide-x divide-gray-200">
                      <div
                        ref={(el) => { sourceRefs.current[idx] = el; }}
                        onScroll={() => handleSourceScroll(idx)}
                        className="diff-content-old diff-scroll-pane bg-red-50/30"
                        dangerouslySetInnerHTML={{
                          __html: getProcessedHtml(
                            chunk.sourceSideHtml ?? chunk.diffHtml,
                          ),
                        }}
                      />
                      <div
                        ref={(el) => { targetRefs.current[idx] = el; }}
                        onScroll={() => handleTargetScroll(idx)}
                        className="diff-content-new diff-scroll-pane bg-green-50/30"
                        dangerouslySetInnerHTML={{
                          __html: getProcessedHtml(
                            chunk.targetSideHtml ?? chunk.diffHtml,
                          ),
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show more / less */}
      {chunks.length > VISIBLE_COUNT && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {showAll
              ? 'Mostrar menos'
              : `Ver ${chunks.length - VISIBLE_COUNT} secciones más (${chunks.length} total)`}
          </button>
        </div>
      )}
    </div>
  );
}
