import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { TransformationsService, CreateTransformationDto } from './transformations.service';

@Controller()
export class TransformationsController {
  constructor(private readonly transformationsService: TransformationsService) {}

  @Post('transformations')
  create(@Body() dto: CreateTransformationDto) {
    return this.transformationsService.create(dto);
  }

  @Get('transformations/:id')
  findOne(@Param('id') id: string) {
    return this.transformationsService.findOne(id);
  }

  @Get('projects/:projectId/transformations')
  findByProject(@Param('projectId') projectId: string) {
    return this.transformationsService.findByProject(projectId);
  }

  @Patch('transformations/:id')
  update(@Param('id') id: string, @Body() body: { content: string }) {
    return this.transformationsService.update(id, body.content);
  }
}
