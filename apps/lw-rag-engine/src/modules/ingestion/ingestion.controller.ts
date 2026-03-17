import {
  Controller, Post, Get, Delete, Param, UploadedFile,
  UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IngestionService } from './ingestion.service';

@Controller('projects/:projectId/documents')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.ingestionService.uploadDocument(projectId, file);
  }

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.ingestionService.listDocuments(projectId);
  }

  @Get(':docId/status')
  status(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
  ) {
    return this.ingestionService.getDocumentStatus(projectId, docId);
  }

  @Delete(':docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
  ) {
    return this.ingestionService.deleteDocument(projectId, docId);
  }
}
