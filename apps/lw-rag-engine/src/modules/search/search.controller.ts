import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { SemanticSearchService } from './semantic-search.service';

@Controller()
export class SearchController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly searchService: SemanticSearchService,
  ) {}

  @Post('projects/:projectId/conversations')
  createConversation(
    @Param('projectId') projectId: string,
    @Body() body: { title?: string },
  ) {
    return this.conversationService.createConversation(projectId, body.title);
  }

  @Get('projects/:projectId/conversations')
  listConversations(@Param('projectId') projectId: string) {
    return this.conversationService.listConversations(projectId);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.conversationService.sendMessage(id, body.content);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string) {
    return this.conversationService.getMessages(id);
  }

  @Post('projects/:projectId/search')
  search(
    @Param('projectId') projectId: string,
    @Body() body: { query: string; limit?: number },
  ) {
    return this.searchService.search(body.query, projectId, body.limit);
  }
}
