import { Injectable, Logger } from '@nestjs/common';

/**
 * Task 5.2 — Compliance PDF Generation Service
 *
 * Generates a PDF report in the format required by the
 * Puerto Rico Department of Justice under Ley 118-2003.
 *
 * STRATEGY: Generate HTML → convert to PDF using Playwright (already in deps).
 * This avoids adding pdfkit as a dependency and gives us rich formatting.
 */
@Injectable()
export class CompliancePdfService {
    private readonly logger = new Logger(CompliancePdfService.name);

    async generatePdf(reportData: any): Promise<Buffer> {
        const html = this.buildHtml(reportData);

        try {
            // Use Playwright for HTML→PDF conversion (already in package.json)
            const { chromium } = require('playwright');
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle' });
            const pdfBuffer = await page.pdf({
                format: 'Letter',
                margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
                printBackground: true,
            });
            await browser.close();
            return Buffer.from(pdfBuffer);
        } catch (err: any) {
            this.logger.warn(`Playwright PDF failed: ${err.message}. Returning HTML as fallback.`);
            // Fallback: return HTML buffer (can be opened in browser and printed)
            return Buffer.from(html, 'utf-8');
        }
    }

    private buildHtml(report: any): string {
        const meta = report.report_metadata;
        const summary = report.summary;
        const legislators = report.legislators || [];
        const measures = report.measures_discussed || [];

        const contactTypeLabels: Record<string, string> = {
            reunion_presencial: 'Reunión Presencial',
            llamada: 'Llamada Telefónica',
            correo: 'Correo Electrónico',
            evento: 'Evento',
        };

        const positionLabels: Record<string, string> = {
            a_favor: 'A Favor',
            en_contra: 'En Contra',
            indeciso: 'Indeciso',
            no_se_pronuncio: 'No se Pronunció',
        };

        const chamberLabel = (c: string) => c === 'upper' ? 'Senado' : 'Cámara';

        // Build legislators section
        const legislatorSections = legislators.map((leg: any, i: number) => {
            const interactionRows = (leg.interactions || []).map((inter: any) => {
                const date = new Date(inter.date).toLocaleDateString('es-PR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                });
                const type = contactTypeLabels[inter.contact_type] || inter.contact_type;
                const measuresStr = (inter.measures || [])
                    .map((m: any) => {
                        const num = m.measure_number || m.measure_reference || '—';
                        const pos = m.position_expressed ? ` (${positionLabels[m.position_expressed] || m.position_expressed})` : '';
                        return `${num}${pos}`;
                    })
                    .join(', ') || 'Tema general';
                const participants = (inter.participants || [])
                    .map((p: any) => p.staff_name || 'Legislador')
                    .join(', ');

                return `<tr>
                    <td>${date}</td>
                    <td>${type}</td>
                    <td>${measuresStr}</td>
                    <td>${participants}</td>
                </tr>`;
            }).join('');

            return `
            <div class="legislator-section" ${i > 0 ? 'style="page-break-before: auto;"' : ''}>
                <h3>${i + 1}. ${leg.legislator_name}</h3>
                <p class="details">
                    ${chamberLabel(leg.legislator_chamber)} | ${leg.legislator_party} | ${leg.legislator_district || 'Acumulación'}
                    <br>Total de contactos: <strong>${leg.total_contacts}</strong>
                    | Medidas discutidas: <strong>${leg.measures_discussed?.length || 0}</strong>
                </p>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo de Contacto</th>
                            <th>Medidas / Posición</th>
                            <th>Participantes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${interactionRows}
                    </tbody>
                </table>
            </div>`;
        }).join('');

        // Build measures summary
        const measureRows = measures.map((m: any) =>
            `<tr><td>${m.number}</td><td>${m.title || '—'}</td></tr>`
        ).join('');

        // Contact type summary
        const typeRows = Object.entries(summary.by_contact_type || {})
            .map(([type, count]) =>
                `<tr><td>${contactTypeLabels[type] || type}</td><td>${count}</td></tr>`
            ).join('');

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8"/>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #1a1a1a;
        }
        .header {
            text-align: center;
            margin-bottom: 24px;
            border-bottom: 2px solid #333;
            padding-bottom: 16px;
        }
        .header h1 {
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .header h2 {
            font-size: 13px;
            font-weight: normal;
            margin-top: 4px;
            color: #555;
        }
        .header p {
            font-size: 10px;
            color: #777;
            margin-top: 8px;
        }
        .summary-box {
            background: #f5f5f5;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 20px;
        }
        .summary-box h3 {
            font-size: 12px;
            margin-bottom: 8px;
        }
        .summary-grid {
            display: flex;
            gap: 24px;
        }
        .summary-stat {
            text-align: center;
        }
        .summary-stat .number {
            font-size: 20px;
            font-weight: bold;
            color: #333;
        }
        .summary-stat .label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 16px;
            font-size: 10px;
        }
        table th {
            background: #e8e8e8;
            padding: 6px 8px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #ccc;
        }
        table td {
            padding: 5px 8px;
            border: 1px solid #ddd;
            vertical-align: top;
        }
        table tbody tr:nth-child(even) {
            background: #fafafa;
        }
        .legislator-section {
            margin-bottom: 20px;
        }
        .legislator-section h3 {
            font-size: 12px;
            margin-bottom: 4px;
            color: #222;
            border-bottom: 1px solid #eee;
            padding-bottom: 4px;
        }
        .legislator-section .details {
            font-size: 10px;
            color: #555;
            margin-bottom: 8px;
        }
        .footer {
            margin-top: 30px;
            border-top: 1px solid #ccc;
            padding-top: 12px;
            font-size: 9px;
            color: #888;
            text-align: center;
        }
        h2.section-title {
            font-size: 13px;
            margin: 20px 0 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Informe Semestral de Actividades de Cabildeo</h1>
        <h2>${meta.law_reference}</h2>
        <p>Período: ${meta.period_label} | Generado: ${new Date(meta.generated_at).toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div class="summary-box">
        <h3>Resumen del Período</h3>
        <div class="summary-grid">
            <div class="summary-stat">
                <div class="number">${summary.total_interactions}</div>
                <div class="label">Contactos Totales</div>
            </div>
            <div class="summary-stat">
                <div class="number">${summary.total_legislators_contacted}</div>
                <div class="label">Legisladores Contactados</div>
            </div>
            <div class="summary-stat">
                <div class="number">${summary.total_unique_measures}</div>
                <div class="label">Medidas Discutidas</div>
            </div>
            <div class="summary-stat">
                <div class="number">${summary.by_chamber?.senado || 0}</div>
                <div class="label">Senadores</div>
            </div>
            <div class="summary-stat">
                <div class="number">${summary.by_chamber?.camara || 0}</div>
                <div class="label">Representantes</div>
            </div>
        </div>
    </div>

    <h2 class="section-title">Desglose por Tipo de Contacto</h2>
    <table>
        <thead><tr><th>Tipo de Contacto</th><th>Cantidad</th></tr></thead>
        <tbody>${typeRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>

    <h2 class="section-title">Detalle por Legislador</h2>
    ${legislatorSections || '<p>Sin interacciones registradas en este período.</p>'}

    <h2 class="section-title" style="page-break-before: auto;">Medidas Legislativas Discutidas</h2>
    <table>
        <thead><tr><th>Número</th><th>Título</th></tr></thead>
        <tbody>${measureRows || '<tr><td colspan="2">Sin medidas</td></tr>'}</tbody>
    </table>

    <div class="footer">
        <p>Este informe ha sido generado por el sistema LegalWatch / SUTRA para cumplimiento con la Ley 118-2003.</p>
        <p>Departamento de Justicia de Puerto Rico — Registro de Cabildeo</p>
    </div>
</body>
</html>`;
    }
}
