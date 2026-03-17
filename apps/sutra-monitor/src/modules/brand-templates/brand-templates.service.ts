import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  header_image_url?: string;
  header_html?: string;
  footer_html?: string;
  footer_image_url?: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_position: 'left' | 'center' | 'right';
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export type CreateBrandTemplateDto = Omit<
  BrandTemplate,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

// Inline Multer file type to avoid @types/multer dependency issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BrandTemplatesService {
  constructor(private readonly db: DatabaseService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async getTemplates(userId: string): Promise<BrandTemplate[]> {
    const result = await this.db.query(
      `SELECT * FROM document_brand_templates
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getTemplate(id: string, userId: string): Promise<BrandTemplate> {
    const result = await this.db.query(
      `SELECT * FROM document_brand_templates WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Brand template ${id} not found`);
    }
    const template = result.rows[0] as BrandTemplate;
    if (template.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return template;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createTemplate(
    userId: string,
    dto: CreateBrandTemplateDto,
  ): Promise<BrandTemplate> {
    // If marking as default, clear existing defaults first
    if (dto.is_default) {
      await this.db.query(
        `UPDATE document_brand_templates SET is_default = false, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
    }

    const result = await this.db.query(
      `INSERT INTO document_brand_templates
         (user_id, name, description, header_image_url, header_html, footer_html,
          footer_image_url, primary_color, secondary_color, font_family,
          logo_position, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        userId,
        dto.name,
        dto.description ?? null,
        dto.header_image_url ?? null,
        dto.header_html ?? null,
        dto.footer_html ?? null,
        dto.footer_image_url ?? null,
        dto.primary_color ?? '#1a365d',
        dto.secondary_color ?? '#2d3748',
        dto.font_family ?? 'Arial, sans-serif',
        dto.logo_position ?? 'left',
        dto.is_default ?? false,
      ],
    );
    return result.rows[0];
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateTemplate(
    id: string,
    userId: string,
    dto: Partial<BrandTemplate>,
  ): Promise<BrandTemplate> {
    // Validate ownership
    await this.getTemplate(id, userId);

    // If marking as default, clear others first
    if (dto.is_default === true) {
      await this.db.query(
        `UPDATE document_brand_templates SET is_default = false, updated_at = NOW()
         WHERE user_id = $1 AND id != $2`,
        [userId, id],
      );
    }

    // Build dynamic SET clause
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const updatable: Array<keyof BrandTemplate> = [
      'name',
      'description',
      'header_image_url',
      'header_html',
      'footer_html',
      'footer_image_url',
      'primary_color',
      'secondary_color',
      'font_family',
      'logo_position',
      'is_default',
    ];

    for (const key of updatable) {
      if (key in dto) {
        fields.push(`${key} = $${idx++}`);
        values.push((dto as any)[key]);
      }
    }

    if (fields.length === 0) {
      return this.getTemplate(id, userId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE document_brand_templates SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values,
    );
    return result.rows[0];
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteTemplate(id: string, userId: string): Promise<void> {
    // Validate ownership
    await this.getTemplate(id, userId);

    await this.db.query(
      `DELETE FROM document_brand_templates WHERE id = $1`,
      [id],
    );
  }

  // ── Set default ───────────────────────────────────────────────────────────

  async setDefault(id: string, userId: string): Promise<BrandTemplate> {
    // Validate ownership
    await this.getTemplate(id, userId);

    // Clear all defaults for this user
    await this.db.query(
      `UPDATE document_brand_templates SET is_default = false, updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );

    // Set this one as default
    const result = await this.db.query(
      `UPDATE document_brand_templates SET is_default = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return result.rows[0];
  }

  // ── Get default ───────────────────────────────────────────────────────────

  async getDefaultTemplate(userId: string): Promise<BrandTemplate | null> {
    const result = await this.db.query(
      `SELECT * FROM document_brand_templates
       WHERE user_id = $1 AND is_default = true
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  // ── Upload logo ───────────────────────────────────────────────────────────

  /**
   * Saves the uploaded file to /tmp/brand-assets/{userId}/ and returns a URL.
   * In production this would upload to S3/GCS. For now, saves locally.
   */
  async uploadLogo(
    userId: string,
    file: MulterFile,
  ): Promise<{ url: string }> {
    const dir = path.join('/tmp', 'brand-assets', userId);
    fs.mkdirSync(dir, { recursive: true });

    // Sanitize filename
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safeName = `logo_${Date.now()}${ext}`;
    const filePath = path.join(dir, safeName);

    if (file.buffer) {
      fs.writeFileSync(filePath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, filePath);
    }

    // Return a relative URL that can be served by a static file middleware
    // or the frontend can construct the full URL from NEXT_PUBLIC_MONITOR_URL
    const url = `/brand-assets/${userId}/${safeName}`;
    return { url };
  }

  // ── Apply template to HTML ────────────────────────────────────────────────

  /**
   * Wraps content HTML with the template's header and footer.
   * Returns a complete HTML document with styles applied.
   */
  applyTemplateToHtml(
    html: string,
    template: BrandTemplate | null,
  ): string {
    if (!template) {
      return html;
    }

    const logoAlignMap = {
      left: 'flex-start',
      center: 'center',
      right: 'flex-end',
    };
    const logoAlign = logoAlignMap[template.logo_position] ?? 'flex-start';

    const headerLogoHtml = template.header_image_url
      ? `<img src="${template.header_image_url}" alt="Logo" style="max-height:60px; max-width:200px; object-fit:contain;" />`
      : '';

    const footerLogoHtml = template.footer_image_url
      ? `<img src="${template.footer_image_url}" alt="Logo" style="max-height:40px; max-width:140px; object-fit:contain;" />`
      : '';

    const headerContent = template.header_html
      ? template.header_html
      : headerLogoHtml
        ? `<div style="display:flex; justify-content:${logoAlign}; align-items:center;">${headerLogoHtml}</div>`
        : '';

    const footerContent = template.footer_html
      ? template.footer_html
      : footerLogoHtml
        ? `<div style="display:flex; justify-content:${logoAlign}; align-items:center;">${footerLogoHtml}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${template.font_family};
      color: #1a1a1a;
      background: #fff;
    }
    .brand-header {
      background-color: ${template.primary_color};
      color: #fff;
      padding: 16px 32px;
      border-bottom: 4px solid ${template.secondary_color};
    }
    .brand-content {
      padding: 32px;
    }
    .brand-footer {
      background-color: ${template.secondary_color};
      color: #fff;
      padding: 12px 32px;
      border-top: 4px solid ${template.primary_color};
      margin-top: 32px;
      font-size: 0.85em;
    }
    @media print {
      .brand-header, .brand-footer { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="brand-header">${headerContent}</div>
  <div class="brand-content">${html}</div>
  <div class="brand-footer">${footerContent}</div>
</body>
</html>`;
  }
}
