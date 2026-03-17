import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CoalitionsService } from './coalitions.service';
import { UserID } from '../auth/decorators';
import type {
  CreateCoalitionDto,
  AddMemberDto,
  AddCommitmentDto,
  AddMessageDto,
} from './coalitions.service';

// ─── Patch / update body shapes ─────────────────────────────────────────────

interface UpdateCoalitionBody {
  name?: string;
  bill_id?: string;
  is_active?: boolean;
}

interface UpdateMemberBody extends Partial<AddMemberDto> {}

interface UpdateCommitmentBody
  extends Partial<AddCommitmentDto & { status: 'pending' | 'completed' | 'cancelled' }> {}

// ─── Controller ─────────────────────────────────────────────────────────────

/**
 * All endpoints under this controller require a valid JWT.
 * There is no @Public() decorator — the global JwtAuthGuard enforces auth.
 */
@Controller('')
export class CoalitionsController {
  constructor(private readonly service: CoalitionsService) {}

  // ─── Coalitions ─────────────────────────────────────────────────────────

  @Get('coalitions')
  getCoalitions(@UserID() userId: string) {
    return this.service.getCoalitions(userId);
  }

  @Post('coalitions')
  @HttpCode(HttpStatus.CREATED)
  createCoalition(
    @UserID() userId: string,
    @Body() body: CreateCoalitionDto,
  ) {
    return this.service.createCoalition(userId, body);
  }

  @Get('coalitions/:id')
  getCoalitionById(@Param('id') id: string, @UserID() userId: string) {
    return this.service.getCoalitionById(id, userId);
  }

  @Patch('coalitions/:id')
  updateCoalition(
    @Param('id') id: string,
    @UserID() userId: string,
    @Body() body: UpdateCoalitionBody,
  ) {
    return this.service.updateCoalition(id, userId, body);
  }

  @Delete('coalitions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCoalition(@Param('id') id: string, @UserID() userId: string) {
    await this.service.deleteCoalition(id, userId);
  }

  // ─── Members ─────────────────────────────────────────────────────────────

  @Post('coalitions/:id/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Param('id') coalitionId: string,
    @UserID() userId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.service.addMember(coalitionId, userId, body);
  }

  @Patch('coalitions/:id/members/:memberId')
  updateMember(
    @Param('id') coalitionId: string,
    @Param('memberId') memberId: string,
    @UserID() userId: string,
    @Body() body: UpdateMemberBody,
  ) {
    return this.service.updateMember(coalitionId, memberId, userId, body);
  }

  @Delete('coalitions/:id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') coalitionId: string,
    @Param('memberId') memberId: string,
    @UserID() userId: string,
  ) {
    await this.service.removeMember(coalitionId, memberId, userId);
  }

  // ─── Commitments ─────────────────────────────────────────────────────────

  @Post('coalitions/:id/commitments')
  @HttpCode(HttpStatus.CREATED)
  addCommitment(
    @Param('id') coalitionId: string,
    @UserID() userId: string,
    @Body() body: AddCommitmentDto,
  ) {
    return this.service.addCommitment(coalitionId, userId, body);
  }

  @Patch('coalitions/:id/commitments/:commitmentId')
  updateCommitment(
    @Param('id') coalitionId: string,
    @Param('commitmentId') commitmentId: string,
    @UserID() userId: string,
    @Body() body: UpdateCommitmentBody,
  ) {
    return this.service.updateCommitment(coalitionId, commitmentId, userId, body);
  }

  @Delete('coalitions/:id/commitments/:commitmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCommitment(
    @Param('id') coalitionId: string,
    @Param('commitmentId') commitmentId: string,
    @UserID() userId: string,
  ) {
    await this.service.deleteCommitment(coalitionId, commitmentId, userId);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  @Post('coalitions/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  addMessage(
    @Param('id') coalitionId: string,
    @UserID() userId: string,
    @Body() body: AddMessageDto,
  ) {
    return this.service.addMessage(coalitionId, userId, body);
  }

  @Get('coalitions/:id/messages')
  getMessages(
    @Param('id') coalitionId: string,
    @UserID() userId: string,
  ) {
    return this.service.getMessages(coalitionId, userId);
  }

  // ─── Lobbyists ────────────────────────────────────────────────────────────

  @Get('lobbyists/search')
  searchLobbyists(
    @Query('q') q: string,
    @Query('sector') sector?: string,
  ) {
    return this.service.searchLobbyists(q ?? '', sector);
  }

  @Get('bills/:billId/lobbyists')
  getLobbyistsByBillSector(@Param('billId') billId: string) {
    return this.service.getLobbyistsByBillSector(billId);
  }
}
