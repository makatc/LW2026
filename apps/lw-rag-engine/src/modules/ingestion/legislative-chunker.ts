import { Injectable } from '@nestjs/common';
import { ChunkType } from '../../entities/dossier-chunk.entity';

export interface TextChunk {
  content: string;
  chunk_type: ChunkType;
  section_reference?: string;
  page_number?: number;
  chunk_index: number;
}

interface RawBlock {
  content: string;
  chunk_type: ChunkType;
  section_reference?: string;
  page_number?: number;
}

const MAX_TOKENS_ESTIMATE = 800; // ~800 words ≈ 1000 tokens
const OVERLAP_TOKENS = 100; // ~100 words overlap

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

function splitWithOverlap(text: string, maxWords: number, overlapWords: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = end - overlapWords;
  }
  return chunks;
}

@Injectable()
export class LegislativeChunker {
  private readonly patterns = {
    exposicionMotivos: /^\s*(EXPOSICIÓN\s+DE\s+MOTIVOS|EXPOSE\s+DE\s+MOTIVOS|DECLARACIÓN\s+DE\s+PROPÓSITO)/im,
    articulo: /^\s*(ARTÍCULO\s+\d+[A-Z]?\.?|ARTICLE\s+\d+)/im,
    seccion: /^\s*(SECCIÓN\s+\d+[\.\-]\d+|SEC\.\s+\d+)/im,
    inciso: /^\s*([a-z]\)\s+)/m,
    ponencia: /^\s*(PONENCIA\s+DE|TESTIMONIO\s+DE|DECLARACIÓN\s+ANTE)/im,
  };

  isPonencia(fullText: string): boolean {
    const firstLines = fullText.slice(0, 500);
    return this.patterns.ponencia.test(firstLines);
  }

  chunk(fullText: string, defaultPageNum?: number): TextChunk[] {
    const isPonencia = this.isPonencia(fullText);
    const rawBlocks = this.splitIntoBlocks(fullText, isPonencia);
    const finalChunks: TextChunk[] = [];
    let idx = 0;

    for (const block of rawBlocks) {
      const tokenCount = estimateTokens(block.content);
      if (tokenCount > MAX_TOKENS_ESTIMATE) {
        const maxWords = Math.floor(MAX_TOKENS_ESTIMATE / 1.3);
        const overlapWords = Math.floor(OVERLAP_TOKENS / 1.3);
        const subTexts = splitWithOverlap(block.content, maxWords, overlapWords);
        for (const sub of subTexts) {
          finalChunks.push({
            content: sub.trim(),
            chunk_type: block.chunk_type,
            section_reference: block.section_reference,
            page_number: block.page_number ?? defaultPageNum,
            chunk_index: idx++,
          });
        }
      } else {
        finalChunks.push({
          content: block.content.trim(),
          chunk_type: block.chunk_type,
          section_reference: block.section_reference,
          page_number: block.page_number ?? defaultPageNum,
          chunk_index: idx++,
        });
      }
    }

    return finalChunks.filter((c) => c.content.length > 20);
  }

  private splitIntoBlocks(text: string, isPonenciaDoc: boolean): RawBlock[] {
    const lines = text.split('\n');
    const blocks: RawBlock[] = [];
    let currentBlock: RawBlock | null = null;

    for (const line of lines) {
      const chunkType = this.detectLineType(line, isPonenciaDoc);

      if (chunkType !== null) {
        if (currentBlock && currentBlock.content.trim().length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          content: line + '\n',
          chunk_type: chunkType,
          section_reference: line.trim().slice(0, 100),
        };
      } else if (currentBlock) {
        currentBlock.content += line + '\n';
      } else {
        currentBlock = {
          content: line + '\n',
          chunk_type: isPonenciaDoc ? ChunkType.PONENCIA : ChunkType.GENERAL,
        };
      }
    }

    if (currentBlock && currentBlock.content.trim().length > 0) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  private detectLineType(line: string, isPonenciaDoc: boolean): ChunkType | null {
    if (this.patterns.exposicionMotivos.test(line)) return ChunkType.EXPOSICION_DE_MOTIVOS;
    if (this.patterns.articulo.test(line)) return ChunkType.ARTICULO;
    if (this.patterns.seccion.test(line)) return ChunkType.SECCION;
    if (this.patterns.inciso.test(line)) return ChunkType.INCISO;
    if (isPonenciaDoc && this.patterns.ponencia.test(line)) return ChunkType.PONENCIA;
    return null;
  }
}
