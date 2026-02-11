# FASE 2 - Backend Implementation Status

## ✅ Completado

### 1. File Upload System
- ✅ **FileParserService**: Parse Word (.doc, .docx), PDF, TXT files
  - Usa `mammoth` para Word
  - Usa `pdf-parse` para PDF
  - Extrae metadata (pageCount, wordCount)
  - Validación de tipo y tamaño de archivo (max 10MB)

- ✅ **UploadService**: Gestión de uploads
  - SHA256 deduplication
  - Auto-ingestion opcional
  - Batch upload support
  - Crea SourceSnapshot + Document + DocumentVersion

- ✅ **Endpoints**:
  - `POST /documents/upload` - Upload single file
  - `POST /documents/upload/batch` - Upload multiple files

### 2. Search System
- ✅ **SearchService**: Búsqueda de documentos
  - Full-text search en title, description, metadata
  - Relevance scoring (0-1)
  - Spanish stopwords filtering
  - Similar documents finder (keyword-based)
  - Pag

ination support

## 🚧 Pendiente de Implementar

### 3. Search Endpoints (5 min)
Agregar al `DocumentsController`:

```typescript
/**
 * Search documents
 * GET /documents/search?q=query&limit=20&offset=0
 */
@Get('search')
async searchDocuments(
  @Query('q') query: string,
  @Query('limit') limit?: string,
  @Query('offset') offset?: string,
  @Query('type') documentType?: string,
): Promise<{
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}> {
  return this.searchService.searchDocuments({
    query,
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0,
    documentType,
    includeVersions: true,
  });
}

/**
 * Find similar documents
 * POST /documents/find-similar
 */
@Post('find-similar')
async findSimilar(
  @Body() body: { text: string; limit?: number },
): Promise<SearchResult[]> {
  return this.searchService.findSimilarDocuments(
    body.text,
    body.limit || 10,
  );
}
```

### 4. Related Laws Detection Service (15 min)
Crear `RelatedLawsService`:

```typescript
// src/documents/services/related-laws.service.ts
export class RelatedLawsService {
  /**
   * Detect if document is an amendment and find original law
   */
  async findRelatedLaws(documentId: string): Promise<{
    isAmendment: boolean;
    originalLaw?: Document;
    amendments?: Document[];
    relatedLaws?: Document[];
  }> {
    // 1. Check if title contains "enmienda", "modifica", "reforma"
    // 2. Extract law reference (e.g., "Ley 123-45")
    // 3. Search for original law by reference
    // 4. Find other amendments to same law
  }
}
```

### 5. Quick Compare Endpoint (10 min)
Agregar al `ComparisonController`:

```typescript
/**
 * Quick compare two texts without ingestion
 * POST /comparison/quick
 */
@Post('quick')
async quickCompare(
  @Body() body: { sourceText: string; targetText: string },
): Promise<{
  diffHtml: string;
  sideBySide: { oldHtml: string; newHtml: string };
  similarity: number;
  changePercentage: number;
}> {
  // Use DiffService directly without creating documents
  const diff = this.diffService.generateDiff(body.sourceText, body.targetText);
  const sideBySide = this.diffService.generateSideBySideDiff(
    body.sourceText,
    body.targetText,
  );
  const similarity = this.diffService.calculateSimilarity(
    body.sourceText,
    body.targetText,
  );

  return {
    diffHtml: diff.htmlDiff,
    sideBySide,
    similarity,
    changePercentage: diff.changePercentage,
  };
}
```

### 6. Update Modules (2 min)
Agregar a `DocumentsModule.providers`:
```typescript
SearchService,
RelatedLawsService, // cuando se cree
```

Agregar a `DocumentsModule.exports`:
```typescript
SearchService,
```

### 7. Tests (30 min)
Crear tests para:
- `file-parser.service.spec.ts`
- `upload.service.spec.ts`
- `search.service.spec.ts`
- `related-laws.service.spec.ts` (cuando se cree)

## 📊 Estimación de Tiempo Restante

- Search endpoints: **5 min**
- Related Laws Service: **15 min**
- Quick Compare endpoint: **10 min**
- Update modules: **2 min**
- Tests: **30 min**

**Total**: ~1 hora

## 🚀 Próximos Pasos

Una vez completada FASE 2, proceder con:

### FASE 3: Frontend - Source/Target Selectors
- FileUploader component (drag & drop)
- DashboardPicker component
- Integration con backend endpoints

### FASE 4: Frontend - Results & Visualization
- DiffViewer (side-by-side, inline modes)
- Semantic changes visualization
- Export functionality

### FASE 5: Dashboard Integration
- Botón "Comparar" en medidas
- Drag & drop desde watchlist
- Link directo a comparador

## 📝 Notas Técnicas

### Arquitectura de Upload
```
User uploads file
    ↓
FileParserService extracts text
    ↓
Create SourceSnapshot (SHA256 hash)
    ↓
Create Document + DocumentVersion
    ↓
Auto-ingest (optional) → BullMQ job
    ↓
StructureDetectorService + NormalizerService
    ↓
Create DocumentChunks
```

### Arquitectura de Search
```
User queries "Ley 123"
    ↓
SearchService.searchDocuments()
    ↓
- Search in title (score: 0.8)
- Search in description (score: 0.5)
- Search in metadata (score: 0.3)
    ↓
Sort by relevance score
    ↓
Return paginated results with versions
```

### Deduplication Strategy
- SHA256 hash calculated on raw content
- Prevents duplicate uploads of same file
- Future: Link to existing document/version instead of creating new

### Vector Search (Future Enhancement)
Currently using keyword search. Future implementation:
1. Generate embeddings for document chunks
2. Store in `embedding` column (vector(1536))
3. Use pgvector for similarity search:
   ```sql
   SELECT * FROM document_chunks
   ORDER BY embedding <-> query_embedding
   LIMIT 10;
   ```

## 🐛 Known Issues

1. **PDF parsing**: Some complex PDFs may have layout issues
   - Consider using `pdf2json` for better structure preservation

2. **Word parsing**: Tables not handled well by mammoth
   - May need custom table extraction logic

3. **Search relevance**: Simple keyword matching
   - Future: Implement BM25 or vector similarity

4. **Related laws detection**: Pattern-based (fragile)
   - Future: Use NLP/LLM for better detection

## 💡 Future Enhancements

1. **OCR Support**: Extract text from scanned PDFs
2. **Multi-language Support**: Detect language and use appropriate stopwords
3. **Advanced Search**: Filters by date, type, tags
4. **Saved Searches**: User can save frequent searches
5. **Search History**: Track popular searches
6. **Fuzzy Matching**: Handle typos in search queries
7. **Autocomplete**: Suggest documents as user types
