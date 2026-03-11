import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import { DatabaseService } from '../../modules/database/database.service';
import { ScraperRunRecorder } from '../scraper-run.recorder';
import { BaseScraper, PipelineResult } from '../base-scraper';
import { ChangeEventService } from '../change-event/change-event.service';

@Injectable()
export class BillTextScraper implements BaseScraper {
    private readonly logger = new Logger(BillTextScraper.name);
    readonly scraperName = 'bill-text';
    private readonly geminiApiKey = process.env.GEMINI_API_KEY;
    private readonly geminiModel = 'gemini-2.0-flash';

    constructor(
        private readonly db: DatabaseService,
        private readonly recorder: ScraperRunRecorder,
        @Optional() private readonly changeEvents?: ChangeEventService,
    ) {}

    async runPipeline(): Promise<PipelineResult> {
        const startTime = Date.now();
        const runId = await this.recorder.start(this.scraperName);

        try {
            this.logger.log('Starting bill-text extraction pipeline...');

            // Find measures with PDF URLs that don't have a current bill_version
            const measures = await this.findMeasuresNeedingExtraction();
            this.logger.log(`Found ${measures.length} measures needing text extraction`);

            let newCount = 0;
            let updatedCount = 0;

            for (const measure of measures) {
                try {
                    const result = await this.extractAndVersion(measure);
                    if (result === 'new') newCount++;
                    else if (result === 'updated') updatedCount++;
                } catch (err: any) {
                    this.logger.warn(`Text extraction failed for ${measure.numero}: ${err.message}`);
                }
            }

            await this.recorder.complete(runId, measures.length, newCount, updatedCount);
            return {
                scraperName: this.scraperName,
                recordsScraped: measures.length,
                recordsNew: newCount,
                recordsUpdated: updatedCount,
                durationMs: Date.now() - startTime,
            };
        } catch (error: any) {
            this.logger.error('Pipeline failed:', error.message);
            await this.recorder.fail(runId, error.message);
            return {
                scraperName: this.scraperName,
                recordsScraped: 0,
                recordsNew: 0,
                recordsUpdated: 0,
                durationMs: Date.now() - startTime,
                error: error.message,
            };
        }
    }

    private async findMeasuresNeedingExtraction(): Promise<any[]> {
        // Find measures that have a PDF URL but no current bill_version, OR
        // measures whose source_url ends in .pdf
        const res = await this.db.query(
            `SELECT sm.id, sm.numero, sm.source_url
             FROM sutra_measures sm
             LEFT JOIN bill_versions bv ON bv.measure_id = sm.id AND bv.is_current = true
             WHERE (sm.source_url ILIKE '%.pdf' OR sm.source_url ILIKE '%pdf%')
               AND bv.id IS NULL
             ORDER BY sm.updated_at DESC
             LIMIT 20`
        );
        return res.rows;
    }

    async extractAndVersion(measure: { id: string; numero: string; source_url: string }): Promise<'new' | 'updated' | 'unchanged'> {
        const pdfUrl = measure.source_url;
        this.logger.debug(`Extracting text from PDF: ${pdfUrl}`);

        // Download PDF
        const pdfBuffer = await this.downloadPdf(pdfUrl);
        if (!pdfBuffer) return 'unchanged';

        // Extract text
        let textContent = await this.extractText(pdfBuffer);
        if (!textContent || textContent.trim().length < 50) {
            this.logger.debug(`pdf-parse got insufficient text for ${measure.numero}, trying Gemini OCR...`);
            textContent = await this.geminiOcr(pdfBuffer);
        }

        if (!textContent || textContent.trim().length < 10) {
            this.logger.warn(`Could not extract text from ${measure.numero}`);
            return 'unchanged';
        }

        const hash = crypto.createHash('sha256').update(textContent).digest('hex');

        // Check current version
        const currentRes = await this.db.query(
            'SELECT id, hash FROM bill_versions WHERE measure_id = $1 AND is_current = true',
            [measure.id]
        );
        const current = currentRes.rows[0];

        if (current && current.hash === hash) {
            return 'unchanged'; // No change
        }

        // Mark previous versions as not current
        await this.db.query(
            'UPDATE bill_versions SET is_current = false WHERE measure_id = $1',
            [measure.id]
        );

        // Insert new version
        await this.db.query(
            `INSERT INTO bill_versions (measure_id, version_note, text_content, pdf_url, hash, is_current)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [measure.id, `Version scraped ${new Date().toISOString().split('T')[0]}`, textContent, pdfUrl, hash]
        );

        const result: 'new' | 'updated' = current ? 'updated' : 'new';
        await this.changeEvents?.record({
            entityType: 'bill_version',
            eventType: result === 'new' ? 'created' : 'updated',
            entityId: measure.id,
            scraperName: this.scraperName,
            summary: `Bill text ${result}: ${measure.numero} (${textContent.length} chars)`,
            after: { numero: measure.numero, chars: textContent.length, pdf_url: pdfUrl },
        });
        return result;
    }

    private async downloadPdf(url: string): Promise<Buffer | null> {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 LegalWatch/1.0' },
            });
            return Buffer.from(response.data);
        } catch (err: any) {
            this.logger.warn(`PDF download failed for ${url}: ${err.message}`);
            return null;
        }
    }

    private async extractText(buffer: Buffer): Promise<string> {
        try {
            // pdf-parse v2 exports PDFParse class
            const { PDFParse } = require('pdf-parse');
            const parser = new PDFParse();
            const result = await parser.pdf(buffer);
            return result?.text || '';
        } catch (err: any) {
            this.logger.debug(`pdf-parse failed: ${err.message}`);
            return '';
        }
    }

    private async geminiOcr(buffer: Buffer): Promise<string> {
        if (!this.geminiApiKey) {
            this.logger.warn('GEMINI_API_KEY not set, skipping OCR');
            return '';
        }

        try {
            const base64Pdf = buffer.toString('base64');
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
                {
                    contents: [{
                        parts: [
                            {
                                inline_data: {
                                    mime_type: 'application/pdf',
                                    data: base64Pdf,
                                },
                            },
                            {
                                text: 'Extrae todo el texto de este documento PDF legislativo de Puerto Rico. Devuelve únicamente el texto extraído, sin comentarios ni formateo adicional.',
                            },
                        ],
                    }],
                },
                {
                    timeout: 60000,
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (err: any) {
            this.logger.error(`Gemini OCR failed: ${err.message}`);
            return '';
        }
    }
}
