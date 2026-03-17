import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DossierProject } from '../../entities/dossier-project.entity';

export interface CreateProjectDto {
  name: string;
  description?: string;
  measure_reference?: string;
  organization_id?: string;
  created_by?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  measure_reference?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(DossierProject)
    private readonly projectRepo: Repository<DossierProject>,
  ) {}

  async create(dto: CreateProjectDto): Promise<DossierProject> {
    const project = this.projectRepo.create({
      ...dto,
      deleted: false,
    });
    return this.projectRepo.save(project);
  }

  async findAll(): Promise<DossierProject[]> {
    return this.projectRepo.find({
      where: { deleted: false },
      order: { updated_at: 'DESC' },
      relations: ['documents', 'conversations', 'transformations'],
    });
  }

  async findOne(id: string): Promise<DossierProject> {
    const project = await this.projectRepo.findOne({
      where: { id, deleted: false },
      relations: ['documents', 'conversations', 'transformations'],
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<DossierProject> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    project.deleted = true;
    await this.projectRepo.save(project);
  }
}
