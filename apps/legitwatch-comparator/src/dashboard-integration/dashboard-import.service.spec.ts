import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardImportService } from './dashboard-import.service';
import { SourceSnapshot, SourceType } from '../entities';
import { LawSourceConnector } from './interfaces';
import { LawMetadataDto, LawVersionDto } from './dto';

describe('DashboardImportService', () => {
  let service: DashboardImportService;
  let connector: jest.Mocked<LawSourceConnector>;
  let snapshotRepository: jest.Mocked<Repository<SourceSnapshot>>;

  const mockMetadata: LawMetadataDto = {
    id: 'law-123',
    title: 'Test Law',
    description: 'Test Description',
    documentType: 'LEY',
    sourceUrl: 'https://example.com/law-123',
    author: 'Test Author',
    publishedDate: new Date('2023-01-15'),
    metadata: {},
  };

  const mockVersions: LawVersionDto[] = [
    {
      id: 'version-1',
      documentId: 'law-123',
      versionTag: 'Original',
      content: 'Original content',
      sourceUrl: 'https://example.com/version-1',
      publishedDate: new Date('2023-01-15'),
      metadata: {},
    },
    {
      id: 'version-2',
      documentId: 'law-123',
      versionTag: 'Amendment',
      content: 'Amended content',
      sourceUrl: 'https://example.com/version-2',
      publishedDate: new Date('2024-01-15'),
      metadata: {},
    },
  ];

  const mockContent = 'ARTICULO 1. Test content';

  beforeEach(async () => {
    // Create mock connector
    connector = {
      search: jest.fn(),
      listVersions: jest.fn(),
      fetchVersionText: jest.fn(),
      fetchMetadata: jest.fn(),
    } as jest.Mocked<LawSourceConnector>;

    // Create mock repository
    const mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardImportService,
        {
          provide: 'LAW_SOURCE_CONNECTOR',
          useValue: connector,
        },
        {
          provide: getRepositoryToken(SourceSnapshot),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DashboardImportService>(DashboardImportService);
    snapshotRepository = module.get(getRepositoryToken(SourceSnapshot));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('importFromDashboard', () => {
    it('should import a document and create a new snapshot', async () => {
      // Arrange
      const itemId = 'law-123';
      const versionId = 'version-1';

      connector.fetchMetadata.mockResolvedValue(mockMetadata);
      connector.listVersions.mockResolvedValue(mockVersions);
      connector.fetchVersionText.mockResolvedValue(mockContent);
      snapshotRepository.findOne.mockResolvedValue(null); // No existing snapshot

      const mockSnapshot = {
        id: 'snapshot-1',
        sourceType: SourceType.TEXT,
        sha256Hash: 'abc123',
        rawContent: mockContent,
        sourceUrl: mockVersions[0].sourceUrl,
        originalFileName: 'Test Law_Original.txt',
        fileSize: BigInt(mockContent.length),
        metadata: {},
        createdAt: new Date(),
      } as SourceSnapshot;

      snapshotRepository.create.mockReturnValue(mockSnapshot);
      snapshotRepository.save.mockResolvedValue(mockSnapshot);

      // Act
      const result = await service.importFromDashboard(itemId, versionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.isNew).toBe(true);
      expect(result.itemId).toBe(itemId);
      expect(result.versionId).toBe(versionId);
      expect(result.snapshotId).toBe('snapshot-1');

      expect(connector.fetchMetadata).toHaveBeenCalledWith(itemId);
      expect(connector.listVersions).toHaveBeenCalledWith(itemId);
      expect(connector.fetchVersionText).toHaveBeenCalledWith(versionId);
      expect(snapshotRepository.save).toHaveBeenCalled();
    });

    it('should return existing snapshot if content already exists', async () => {
      // Arrange
      const itemId = 'law-123';
      const versionId = 'version-1';

      connector.fetchMetadata.mockResolvedValue(mockMetadata);
      connector.listVersions.mockResolvedValue(mockVersions);
      connector.fetchVersionText.mockResolvedValue(mockContent);

      const existingSnapshot = {
        id: 'existing-snapshot',
        sha256Hash: 'abc123',
      } as SourceSnapshot;

      snapshotRepository.findOne.mockResolvedValue(existingSnapshot);

      // Act
      const result = await service.importFromDashboard(itemId, versionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.isNew).toBe(false);
      expect(result.snapshotId).toBe('existing-snapshot');
      expect(snapshotRepository.save).not.toHaveBeenCalled();
    });

    it('should import latest version when versionId is not provided', async () => {
      // Arrange
      const itemId = 'law-123';

      connector.fetchMetadata.mockResolvedValue(mockMetadata);
      connector.listVersions.mockResolvedValue(mockVersions);
      connector.fetchVersionText.mockResolvedValue(mockContent);
      snapshotRepository.findOne.mockResolvedValue(null);

      const mockSnapshot = {
        id: 'snapshot-1',
        sourceType: SourceType.TEXT,
        sha256Hash: 'abc123',
        rawContent: mockContent,
      } as SourceSnapshot;

      snapshotRepository.create.mockReturnValue(mockSnapshot);
      snapshotRepository.save.mockResolvedValue(mockSnapshot);

      // Act
      const result = await service.importFromDashboard(itemId);

      // Assert
      expect(result).toBeDefined();
      expect(result.versionId).toBe('version-2'); // Should use latest version
      expect(connector.fetchVersionText).toHaveBeenCalledWith('version-2');
    });

    it('should throw error when document not found', async () => {
      // Arrange
      const itemId = 'invalid-id';
      connector.fetchMetadata.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(service.importFromDashboard(itemId)).rejects.toThrow();
    });

    it('should throw error when no versions are available', async () => {
      // Arrange
      const itemId = 'law-123';
      connector.fetchMetadata.mockResolvedValue(mockMetadata);
      connector.listVersions.mockResolvedValue([]); // No versions

      // Act & Assert
      await expect(service.importFromDashboard(itemId)).rejects.toThrow(
        'No versions found for item law-123',
      );
    });
  });

  describe('importMultipleVersions', () => {
    it('should import multiple versions successfully', async () => {
      // Arrange
      const itemId = 'law-123';
      const versionIds = ['version-1', 'version-2'];

      connector.fetchMetadata.mockResolvedValue(mockMetadata);
      connector.listVersions.mockResolvedValue(mockVersions);
      connector.fetchVersionText.mockResolvedValue(mockContent);
      snapshotRepository.findOne.mockResolvedValue(null);

      const mockSnapshot = {
        id: 'snapshot-1',
        sourceType: SourceType.TEXT,
        sha256Hash: 'abc123',
        rawContent: mockContent,
      } as SourceSnapshot;

      snapshotRepository.create.mockReturnValue(mockSnapshot);
      snapshotRepository.save.mockResolvedValue(mockSnapshot);

      // Act
      const results = await service.importMultipleVersions(itemId, versionIds);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].versionId).toBe('version-1');
      expect(results[1].versionId).toBe('version-2');
    });
  });
});
