import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContractAnalyzerService } from './contract-analyzer.service';
import { UserID } from '../auth/decorators';
import { CONTRACT_ANALYZER_CONSTANTS } from './contract-analyzer.constants';

// Inline Multer file type — avoids @types/multer dependency issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

@Controller('api/contracts')
export class ContractAnalyzerController {
  private readonly logger = new Logger(ContractAnalyzerController.name);

  constructor(private readonly service: ContractAnalyzerService) {}

  /**
   * POST /api/contracts/analyze
   * Upload a PDF or DOCX contract for analysis.
   * Requires JWT auth (no @Public()).
   */
  @Post('analyze')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: process.env.CONTRACT_UPLOAD_DIR || '/tmp/contracts',
      limits: { fileSize: CONTRACT_ANALYZER_CONSTANTS.MAX_FILE_SIZE_BYTES },
    }),
  )
  async analyze(
    @UploadedFile() file: MulterFile,
    @UserID() userId: string | undefined,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Please authenticate to upload contracts.');
    }
    return this.service.uploadAndQueue(userId, file);
  }

  /**
   * GET /api/contracts
   * List last 10 analyses for the authenticated user.
   */
  @Get()
  async listAnalyses(@UserID() userId: string | undefined) {
    if (!userId) {
      throw new UnauthorizedException('Please authenticate to view analyses.');
    }
    return this.service.getUserAnalyses(userId);
  }

  /**
   * GET /api/contracts/:id/status
   */
  @Get(':id/status')
  async getStatus(
    @Param('id') id: string,
    @UserID() userId: string | undefined,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Please authenticate.');
    }
    return this.service.getStatus(id, userId);
  }

  /**
   * GET /api/contracts/:id/report
   * Returns the full report including disclaimer.
   */
  @Get(':id/report')
  async getReport(
    @Param('id') id: string,
    @UserID() userId: string | undefined,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Please authenticate.');
    }
    return this.service.getReport(id, userId);
  }

  /**
   * DELETE /api/contracts/:id
   */
  @Delete(':id')
  async deleteAnalysis(
    @Param('id') id: string,
    @UserID() userId: string | undefined,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Please authenticate.');
    }
    await this.service.deleteAnalysis(id, userId);
    return { success: true };
  }
}
