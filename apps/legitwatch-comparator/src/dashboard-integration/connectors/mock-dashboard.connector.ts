import { Injectable } from '@nestjs/common';
import {
  LawMetadataDto,
  LawVersionDto,
  SearchResultDto,
} from '../dto';
import { LawSourceConnector } from '../interfaces';

/**
 * MockDashboardConnector
 * Provides fake legal data for testing and development purposes
 */
@Injectable()
export class MockDashboardConnector implements LawSourceConnector {
  private readonly mockDocuments: Map<string, LawMetadataDto>;
  private readonly mockVersions: Map<string, LawVersionDto[]>;

  constructor() {
    // Initialize mock data
    this.mockDocuments = new Map([
      [
        'law-123',
        {
          id: 'law-123',
          title: 'Ley de Protección de Datos Personales',
          description: 'Ley que regula la protección de datos personales',
          documentType: 'LEY',
          sourceUrl: 'https://example.com/law-123',
          author: 'Congreso Nacional',
          publishedDate: new Date('2023-01-15'),
          metadata: {
            jurisdiction: 'Nacional',
            status: 'Vigente',
          },
        },
      ],
      [
        'law-456',
        {
          id: 'law-456',
          title: 'Código de Comercio',
          description: 'Código que regula las actividades comerciales',
          documentType: 'CODIGO',
          sourceUrl: 'https://example.com/law-456',
          author: 'Congreso Nacional',
          publishedDate: new Date('2022-06-01'),
          metadata: {
            jurisdiction: 'Nacional',
            status: 'Vigente',
          },
        },
      ],
    ]);

    this.mockVersions = new Map([
      [
        'law-123',
        [
          {
            id: 'version-123-v1',
            documentId: 'law-123',
            versionTag: 'Original-2023',
            content: `ARTÍCULO 1. OBJETO
La presente ley tiene por objeto garantizar el derecho fundamental a la protección de datos personales.

ARTÍCULO 2. ÁMBITO DE APLICACIÓN
Esta ley se aplicará a toda persona natural o jurídica que realice el tratamiento de datos personales.

ARTÍCULO 3. DEFINICIONES
Para los efectos de esta ley, se entenderá por:
a) Dato personal: Cualquier información concerniente a personas naturales identificadas o identificables.
b) Tratamiento: Cualquier operación sobre datos personales.`,
            sourceUrl: 'https://example.com/law-123/v1',
            publishedDate: new Date('2023-01-15'),
            metadata: { version: 'Original' },
          },
          {
            id: 'version-123-v2',
            documentId: 'law-123',
            versionTag: 'Reforma-2024',
            content: `ARTÍCULO 1. OBJETO Y ALCANCE
La presente ley tiene por objeto garantizar y proteger el derecho fundamental a la privacidad y protección de datos personales en el ámbito digital.

ARTÍCULO 2. ÁMBITO DE APLICACIÓN
Esta ley se aplicará a toda persona natural o jurídica, pública o privada, que realice el tratamiento de datos personales dentro del territorio nacional o que ofrezca servicios a residentes nacionales.

ARTÍCULO 3. DEFINICIONES
Para los efectos de esta ley, se entenderá por:
a) Dato personal: Cualquier información concerniente a personas naturales identificadas o identificables, incluyendo datos biométricos y de ubicación.
b) Tratamiento: Cualquier operación o conjunto de operaciones sobre datos personales, sea automatizada o no.
c) Consentimiento: Manifestación de voluntad libre, específica, informada e inequívoca.`,
            sourceUrl: 'https://example.com/law-123/v2',
            publishedDate: new Date('2024-03-20'),
            metadata: { version: 'Reforma', changes: 'Ampliación de alcance y nuevas definiciones' },
          },
        ],
      ],
      [
        'law-456',
        [
          {
            id: 'version-456-v1',
            documentId: 'law-456',
            versionTag: 'Vigente-2022',
            content: `ARTÍCULO 1. COMERCIANTES
Son comerciantes las personas que profesionalmente se ocupan en alguna de las actividades que la ley considera mercantiles.

ARTÍCULO 2. ACTOS DE COMERCIO
La ley reputa actos de comercio: La compra y venta de bienes muebles.`,
            sourceUrl: 'https://example.com/law-456/v1',
            publishedDate: new Date('2022-06-01'),
            metadata: { version: 'Vigente' },
          },
        ],
      ],
    ]);
  }

  async search(
    query: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<SearchResultDto> {
    const allDocs = Array.from(this.mockDocuments.values());
    const filtered = allDocs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query.toLowerCase()) ||
        doc.description?.toLowerCase().includes(query.toLowerCase()),
    );

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filtered.slice(start, end);

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async listVersions(itemId: string): Promise<LawVersionDto[]> {
    const versions = this.mockVersions.get(itemId);
    if (!versions) {
      throw new Error(`Document with ID ${itemId} not found`);
    }
    return versions;
  }

  async fetchVersionText(versionId: string): Promise<string> {
    for (const versions of this.mockVersions.values()) {
      const version = versions.find((v) => v.id === versionId);
      if (version) {
        return version.content;
      }
    }
    throw new Error(`Version with ID ${versionId} not found`);
  }

  async fetchMetadata(itemId: string): Promise<LawMetadataDto> {
    const metadata = this.mockDocuments.get(itemId);
    if (!metadata) {
      throw new Error(`Document with ID ${itemId} not found`);
    }
    return metadata;
  }
}
