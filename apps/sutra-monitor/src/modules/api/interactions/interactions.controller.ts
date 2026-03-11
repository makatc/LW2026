import {
    Controller, Get, Post, Patch, Delete,
    Param, Query, Body, UploadedFile,
    UseInterceptors, ParseFilePipe, MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InteractionsService } from './interactions.service';
import { Public, UserID } from '../../auth/decorators';

// DECISION: Inline Multer file type to avoid @types/multer dependency issues with pnpm store
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

// ─── DTOs ─────────────────────────────────────────────────────────────────────

interface CreateInteractionDto {
    legislator_id: string;
    contact_type: 'reunion_presencial' | 'llamada' | 'correo' | 'evento';
    interaction_date: string;
    notes?: string;
    next_step_description?: string;
    next_step_date?: string;
    participants?: Array<{
        staff_id?: string;
        legislator_id: string;
        custom_name?: string;
    }>;
    measures?: Array<{
        measure_id?: string;
        measure_reference?: string;
        position_expressed?: 'a_favor' | 'en_contra' | 'indeciso' | 'no_se_pronuncio';
    }>;
}

interface UpdateInteractionDto {
    contact_type?: string;
    interaction_date?: string;
    notes?: string;
    next_step_description?: string;
    next_step_date?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('api/interactions')
@Public()
export class InteractionsController {
    constructor(private readonly service: InteractionsService) {}

    @Get()
    findAll(
        @Query('legislator_id') legislatorId?: string,
        @Query('date_from') dateFrom?: string,
        @Query('date_to') dateTo?: string,
        @Query('contact_type') contactType?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.service.findAll({
            legislatorId,
            dateFrom,
            dateTo,
            contactType,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Post()
    create(
        @Body() dto: CreateInteractionDto,
        @UserID() userId?: string,
    ) {
        return this.service.create(dto, userId);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateInteractionDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    softDelete(@Param('id') id: string) {
        return this.service.softDelete(id);
    }

    // ─── Attachments ──────────────────────────────────────────────────────────

    @Post(':id/attachments')
    @UseInterceptors(FileInterceptor('file'))
    uploadAttachment(
        @Param('id') interactionId: string,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
                ],
                fileIsRequired: true,
            }),
        )
        file: MulterFile,
    ) {
        return this.service.uploadAttachment(interactionId, file);
    }

    @Delete(':id/attachments/:attachmentId')
    deleteAttachment(
        @Param('id') interactionId: string,
        @Param('attachmentId') attachmentId: string,
    ) {
        return this.service.deleteAttachment(interactionId, attachmentId);
    }

    @Get(':id/attachments')
    getAttachments(@Param('id') interactionId: string) {
        return this.service.getAttachments(interactionId);
    }
}
