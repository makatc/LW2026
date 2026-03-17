import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BrandTemplatesService, CreateBrandTemplateDto, BrandTemplate } from './brand-templates.service';
import { UserID } from '../auth/decorators';

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

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * All endpoints require a valid JWT (global JwtAuthGuard is active).
 * Routes are prefixed with /api/brand-templates via the ApiModule routing
 * or registered directly at the app level.
 */
@Controller('api/brand-templates')
export class BrandTemplatesController {
  constructor(private readonly service: BrandTemplatesService) {}

  // ── GET /api/brand-templates ──────────────────────────────────────────────

  @Get()
  getTemplates(@UserID() userId: string): Promise<BrandTemplate[]> {
    return this.service.getTemplates(userId);
  }

  // ── POST /api/brand-templates ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTemplate(
    @UserID() userId: string,
    @Body() dto: CreateBrandTemplateDto,
  ): Promise<BrandTemplate> {
    return this.service.createTemplate(userId, dto);
  }

  // ── GET /api/brand-templates/:id ──────────────────────────────────────────

  @Get(':id')
  getTemplate(
    @Param('id') id: string,
    @UserID() userId: string,
  ): Promise<BrandTemplate> {
    return this.service.getTemplate(id, userId);
  }

  // ── PATCH /api/brand-templates/:id ───────────────────────────────────────

  @Patch(':id')
  updateTemplate(
    @Param('id') id: string,
    @UserID() userId: string,
    @Body() dto: Partial<BrandTemplate>,
  ): Promise<BrandTemplate> {
    return this.service.updateTemplate(id, userId, dto);
  }

  // ── DELETE /api/brand-templates/:id ──────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @Param('id') id: string,
    @UserID() userId: string,
  ): Promise<void> {
    await this.service.deleteTemplate(id, userId);
  }

  // ── POST /api/brand-templates/:id/set-default ─────────────────────────────

  @Post(':id/set-default')
  setDefault(
    @Param('id') id: string,
    @UserID() userId: string,
  ): Promise<BrandTemplate> {
    return this.service.setDefault(id, userId);
  }

  // ── POST /api/brand-templates/upload-logo ────────────────────────────────

  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @UserID() userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
        fileIsRequired: true,
      }),
    )
    file: MulterFile,
  ): Promise<{ url: string }> {
    return this.service.uploadLogo(userId, file);
  }
}
