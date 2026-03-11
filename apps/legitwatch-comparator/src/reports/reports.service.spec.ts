import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ComparisonResult } from '../entities/comparison-result.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { Document } from '../entities/document.entity';
import { ComparisonStatus } from '../entities/comparison-result.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let comparisonRepo: Repository<ComparisonResult>;
  let versionRepo: Repository<DocumentVersion>;
  let documentRepo: Repository<Document>;

  const mockComparisonRepo = {
    findOne: jest.fn(),
  };

  const mockVersionRepo = {
    findOne: jest.fn(),
  };

  const mockDocumentRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(ComparisonResult),
          useValue: mockComparisonRepo,
        },
        {
          provide: getRepositoryToken(DocumentVersion),
          useValue: mockVersionRepo,
        },
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepo,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    comparisonRepo = module.get<Repository<ComparisonResult>>(
      getRepositoryToken(ComparisonResult),
    );
    versionRepo = module.get<Repository<DocumentVersion>>(
      getRepositoryToken(DocumentVersion),
    );
    documentRepo = module.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProjectSummary', () => {
    it('should return a complete project summary', async () => {
      const mockDocument1: Document = {
        id: 'doc-1',
        title: 'Ley de Protección de Datos',
        sourceType: 'dashboard',
        sourceId: 'law-123',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      };

      const mockDocument2: Document = {
        id: 'doc-2',
        title: 'Ley de Protección de Datos',
        sourceType: 'dashboard',
        sourceId: 'law-123',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      };

      const mockSourceVersion: DocumentVersion = {
        id: 'version-1',
        documentId: 'doc-1',
        versionTag: '1.0',
        status: 'PROCESSING' as any,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        document: mockDocument1,
        chunks: [],
      };

      const mockTargetVersion: DocumentVersion = {
        id: 'version-2',
        documentId: 'doc-2',
        versionTag: '2.0',
        status: 'PROCESSING' as any,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        document: mockDocument2,
        chunks: [],
      };

      const mockComparison: ComparisonResult = {
        id: 'comparison-1',
        sourceVersionId: 'version-1',
        targetVersionId: 'version-2',
        status: ComparisonStatus.COMPLETED,
        alignmentMap: {},
        chunkComparisons: [
          {
            sourceChunkId: 'chunk-1',
            targetChunkId: 'chunk-2',
            diffHtml: '<ins>New text</ins>',
            changeType: 'obligation_shift',
            impactScore: 0.8,
          },
        ],
        summary: 'Major changes detected',
        impactScore: 0.75,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      mockComparisonRepo.findOne.mockResolvedValue(mockComparison);
      mockVersionRepo.findOne
        .mockResolvedValueOnce(mockSourceVersion)
        .mockResolvedValueOnce(mockTargetVersion);

      const result = await service.getProjectSummary('comparison-1');

      expect(result).toBeDefined();
      expect(result.comparisonId).toBe('comparison-1');
      expect(result.status).toBe(ComparisonStatus.COMPLETED);
      expect(result.sourceDocument.title).toBe('Ley de Protección de Datos');
      expect(result.targetDocument.title).toBe('Ley de Protección de Datos');
      expect(result.totalChanges).toBe(1);
      expect(result.impactScore).toBe(0.75);
    });

    it('should throw NotFoundException when comparison not found', async () => {
      mockComparisonRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getProjectSummary('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when versions not found', async () => {
      const mockComparison: ComparisonResult = {
        id: 'comparison-1',
        sourceVersionId: 'version-1',
        targetVersionId: 'version-2',
        status: ComparisonStatus.COMPLETED,
        alignmentMap: {},
        chunkComparisons: [],
        impactScore: 0,
        createdAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
        summary: undefined,
      };

      mockComparisonRepo.findOne.mockResolvedValue(mockComparison);
      mockVersionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getProjectSummary('comparison-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportToPdf', () => {
    it('should return pending message for valid comparison', async () => {
      const mockComparison: ComparisonResult = {
        id: 'comparison-1',
        sourceVersionId: 'version-1',
        targetVersionId: 'version-2',
        status: ComparisonStatus.COMPLETED,
        alignmentMap: {},
        chunkComparisons: [],
        impactScore: 0,
        createdAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
        summary: undefined,
      };

      mockComparisonRepo.findOne.mockResolvedValue(mockComparison);

      const result = await service.exportToPdf('comparison-1');

      expect(result).toBeDefined();
      expect(result.message).toContain('html-report');
      expect(result.comparisonId).toBe('comparison-1');
      expect(result.status).toBe('deprecated');
    });

    it('returns deprecated stub even when comparison not found', async () => {
      mockComparisonRepo.findOne.mockResolvedValue(null);

      const result = await service.exportToPdf('non-existent');
      expect(result.status).toBe('deprecated');
    });
  });

  describe('getComparisonResult', () => {
    it('should return the raw comparison result', async () => {
      const mockComparison: ComparisonResult = {
        id: 'comparison-1',
        sourceVersionId: 'version-1',
        targetVersionId: 'version-2',
        status: ComparisonStatus.COMPLETED,
        alignmentMap: {},
        chunkComparisons: [],
        impactScore: 0,
        createdAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
        summary: undefined,
      };

      mockComparisonRepo.findOne.mockResolvedValue(mockComparison);

      const result = await service.getComparisonResult('comparison-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('comparison-1');
      expect(result.status).toBe(ComparisonStatus.COMPLETED);
    });

    it('should throw NotFoundException when comparison not found', async () => {
      mockComparisonRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getComparisonResult('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
