import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComparisonResult } from '../entities/comparison-result.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import type { StakeholderAnalysis } from '../comparison/services/llm-analysis.service';

export interface ProjectSummary {
  comparisonId: string;
  status: string;
  sourceDocument: {
    id: string;
    title: string;
    versionId: string;
    versionTag: string;
  };
  targetDocument: {
    id: string;
    title: string;
    versionId: string;
    versionTag: string;
  };
  summary?: string;
  impactScore: number;
  totalChanges: number;
  chunkComparisons: Array<{
    sourceChunkId: string;
    targetChunkId: string;
    label?: string;
    diffHtml: string;
    sourceSideHtml?: string;
    targetSideHtml?: string;
    changeType?: string;
    impactScore?: number;
  }>;
  stakeholderAnalysis?: StakeholderAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ComparisonResult)
    private readonly comparisonRepo: Repository<ComparisonResult>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
  ) {}

  /**
   * Get a detailed project summary including comparison results
   */
  async getProjectSummary(comparisonId: string): Promise<ProjectSummary> {
    this.logger.log(`Generating summary for comparison ${comparisonId}`);

    const comparison = await this.comparisonRepo.findOne({
      where: { id: comparisonId },
    });

    if (!comparison) {
      throw new NotFoundException(
        `Comparison with ID ${comparisonId} not found`,
      );
    }

    // Fetch source and target versions with their documents
    const sourceVersion = await this.versionRepo.findOne({
      where: { id: comparison.sourceVersionId },
      relations: ['document'],
    });

    const targetVersion = await this.versionRepo.findOne({
      where: { id: comparison.targetVersionId },
      relations: ['document'],
    });

    if (!sourceVersion || !targetVersion) {
      throw new NotFoundException('Source or target version not found');
    }

    const summary: ProjectSummary = {
      comparisonId: comparison.id,
      status: comparison.status,
      sourceDocument: {
        id: sourceVersion.document.id,
        title: sourceVersion.document.title,
        versionId: sourceVersion.id,
        versionTag: sourceVersion.versionTag,
      },
      targetDocument: {
        id: targetVersion.document.id,
        title: targetVersion.document.title,
        versionId: targetVersion.id,
        versionTag: targetVersion.versionTag,
      },
      summary: comparison.summary,
      impactScore: comparison.impactScore,
      totalChanges: comparison.chunkComparisons.length,
      chunkComparisons: comparison.chunkComparisons,
      stakeholderAnalysis: comparison.metadata?.stakeholderAnalysis,
      createdAt: comparison.createdAt,
      updatedAt: comparison.updatedAt,
    };

    this.logger.log(
      `Summary generated with ${summary.totalChanges} chunk comparisons`,
    );

    return summary;
  }

  /**
   * Generate a printable HTML report for a comparison.
   * The browser can print/save this as PDF via Ctrl+P.
   */
  async generateHtmlReport(comparisonId: string): Promise<string> {
    const summary = await this.getProjectSummary(comparisonId);
    const date = new Date(summary.createdAt).toLocaleDateString('es-PR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const changeTypeLabel = (t?: string) => {
      const map: Record<string, string> = {
        obligation_shift: 'Cambio de obligación',
        sanction_changed: 'Sanción modificada',
        definition_modified: 'Definición modificada',
        scope_expanded: 'Alcance ampliado',
        scope_reduced: 'Alcance reducido',
        requirement_added: 'Requisito añadido',
        requirement_removed: 'Requisito eliminado',
        deadline_changed: 'Plazo modificado',
        no_semantic_change: 'Sin cambio semántico',
        added: 'Sección añadida',
        removed: 'Sección eliminada',
      };
      return t ? (map[t] ?? t) : '';
    };

    const chunksHtml = summary.chunkComparisons
      .map((c) => {
        const badge = c.changeType
          ? `<span class="badge">${changeTypeLabel(c.changeType)}</span>`
          : '';
        return `
          <div class="chunk">
            <div class="chunk-header">
              <strong>${c.label ?? 'Sección'}</strong>
              ${badge}
              ${c.impactScore != null ? `<span class="score">Impacto: ${c.impactScore}</span>` : ''}
            </div>
            <div class="diff-content">${c.diffHtml}</div>
          </div>`;
      })
      .join('\n');

    const stakeholdersHtml = summary.stakeholderAnalysis?.entities?.length
      ? `<section>
          <h2>Análisis de Impacto por Partes Afectadas</h2>
          ${summary.stakeholderAnalysis.entities.map((e) => `
            <div class="stakeholder">
              <strong>${e.name}</strong> — ${e.type}
              <p>${e.impactDescription ?? ''}</p>
            </div>`).join('')}
        </section>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte — ${summary.sourceDocument.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; font-size: 12pt; color: #111; padding: 2cm; }
  h1 { font-size: 18pt; margin-bottom: 0.3em; }
  h2 { font-size: 14pt; margin: 1.5em 0 0.5em; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { font-size: 10pt; color: #555; margin-bottom: 1.5em; }
  .summary-box { background: #f8f8f8; border-left: 4px solid #2563eb; padding: 1em; margin: 1em 0; }
  .stats { display: flex; gap: 2em; margin: 1em 0; }
  .stat { text-align: center; }
  .stat .value { font-size: 22pt; font-weight: bold; color: #2563eb; }
  .stat .label { font-size: 9pt; color: #555; }
  .chunk { margin: 1em 0; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
  .chunk-header { background: #f9fafb; padding: 0.5em 1em; display: flex; gap: 1em; align-items: center; }
  .badge { font-size: 9pt; background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 999px; }
  .score { font-size: 9pt; color: #6b7280; margin-left: auto; }
  .diff-content { padding: 0.5em 1em; font-family: monospace; font-size: 10pt; line-height: 1.6; }
  ins { background: #dcfce7; text-decoration: none; }
  del { background: #fee2e2; text-decoration: line-through; }
  .stakeholder { margin: 0.5em 0; padding: 0.5em; border-left: 3px solid #7c3aed; }
  @media print {
    body { padding: 1cm; }
    .chunk { break-inside: avoid; }
    @page { margin: 2cm; }
  }
</style>
</head>
<body>
<h1>Reporte de Comparación Legislativa</h1>
<div class="meta">
  <strong>Documento Original:</strong> ${summary.sourceDocument.title} (${summary.sourceDocument.versionTag})<br>
  <strong>Propuesta:</strong> ${summary.targetDocument.title} (${summary.targetDocument.versionTag})<br>
  <strong>Fecha de análisis:</strong> ${date}
</div>

<div class="stats">
  <div class="stat"><div class="value">${summary.impactScore}</div><div class="label">Score de Impacto</div></div>
  <div class="stat"><div class="value">${summary.totalChanges}</div><div class="label">Secciones Analizadas</div></div>
</div>

${summary.summary ? `<section>
  <h2>Resumen Ejecutivo</h2>
  <div class="summary-box">${summary.summary.replace(/\n/g, '<br>')}</div>
</section>` : ''}

<section>
  <h2>Cambios Detectados</h2>
  ${chunksHtml}
</section>

${stakeholdersHtml}

</body>
</html>`;
  }

  /** @deprecated Use generateHtmlReport instead */
  async exportToPdf(comparisonId: string): Promise<{
    message: string;
    comparisonId: string;
    status: string;
  }> {
    // kept for backwards compatibility — redirect callers to html-report endpoint
    return { message: 'Use GET /projects/:id/html-report for export', comparisonId, status: 'deprecated' };
  }

  /**
   * Get comparison result raw data
   */
  async getComparisonResult(comparisonId: string): Promise<ComparisonResult> {
    const comparison = await this.comparisonRepo.findOne({
      where: { id: comparisonId },
    });

    if (!comparison) {
      throw new NotFoundException(
        `Comparison with ID ${comparisonId} not found`,
      );
    }

    return comparison;
  }
}
