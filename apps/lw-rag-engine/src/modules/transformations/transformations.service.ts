import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DossierTransformation, TransformationType, ClientStance, GenerationStatus } from '../../entities/dossier-transformation.entity';

export interface CreateTransformationDto {
  project_id: string;
  transformation_type: TransformationType;
  title: string;
  legislator_id?: string;
  client_stance: ClientStance;
  tone_profile?: string;
  selected_chunk_ids: string[];
  custom_instructions?: string;
  created_by?: string;
}

@Injectable()
export class TransformationsService {
  private readonly logger = new Logger(TransformationsService.name);

  constructor(
    @InjectRepository(DossierTransformation)
    private readonly transformationRepo: Repository<DossierTransformation>,
    @InjectQueue('transformation-queue')
    private readonly transformationQueue: Queue,
  ) {}

  async create(dto: CreateTransformationDto): Promise<DossierTransformation> {
    const transformation = this.transformationRepo.create({
      ...dto,
      generation_status: GenerationStatus.PENDING,
    });
    const saved = await this.transformationRepo.save(transformation);

    await this.transformationQueue.add('generate', { transformationId: saved.id });
    this.logger.log(`Transformation ${saved.id} queued`);
    return saved;
  }

  async findOne(id: string): Promise<DossierTransformation> {
    const t = await this.transformationRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Transformation ${id} not found`);
    return t;
  }

  async findByProject(projectId: string): Promise<DossierTransformation[]> {
    return this.transformationRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
      take: 20,
    });
  }

  async update(id: string, content: string): Promise<DossierTransformation> {
    const t = await this.findOne(id);
    t.generated_content = content;
    return this.transformationRepo.save(t);
  }
}
