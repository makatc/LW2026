# Plan Técnico: Mejora del Pipeline OCR y Extracción de Estructura

> **Fecha:** Marzo 2026
> **Rol:** Senior Software Architect / CTO
> **Objetivo:** Mejorar la calidad de extracción de texto y detección de estructura en el comparador sin romper ninguna función existente de IA (Gemini OCR + LLM análisis).

---

## Estado Actual — Diagnóstico

### Pipeline de ingesta actual

```
Upload (PDF/DOCX/TXT)
    → FileParserService
        ├── DOCX: mammoth.extractRawText()          [OK — texto limpio]
        ├── PDF:  pdf-parse (getText)               [PROBLEMA — falla en scaneados]
        │         └── Fallback: Gemini OCR          [OK pero costoso en tokens]
        └── TXT:  buffer.toString('utf-8')          [OK]
    → NormalizerService (limpieza básica)
    → StructureDetectorService (regex line-by-line)  [PROBLEMA — frágil]
    → IngestionProcessor (BullMQ)
    → DocumentChunk[] en PostgreSQL
```

### Problemas identificados

| # | Problema | Impacto | Archivo |
|---|----------|---------|---------|
| P1 | `pdf-parse` no extrae texto de PDFs nativos con estructura compleja (columnas, tablas, encabezados) | Alto | `file-parser.service.ts:107` |
| P2 | Gemini OCR funciona pero consume tokens y tiene latencia de 15-60s para PDFs largos | Medio | `file-parser.service.ts:164` |
| P3 | `StructureDetectorService` usa regex line-by-line — falla cuando "ARTÍCULO 5" está en la misma línea que el texto | Alto | `structure-detector.service.ts:42` |
| P4 | Patrones de regex solo reconocen Artículo/Capítulo/Sección/Párrafo — no Inciso, Literal, Numeral, Transitorio | Medio | `structure-detector.service.ts:23` |
| P5 | Fallback posicional en `alignChunks` (cuando <50% match por label) produce diffs incorrectos | Alto | `compare.processor.ts:229` |
| P6 | Sin extracción de metadatos legales (número de ley, fecha de aprobación, legislatura) | Bajo | — |

---

## Arquitectura Propuesta — Tres Capas de Extracción

```
Upload
    → Capa 0: Validación y detección de tipo real (magic bytes, no solo mimetype)
    → Capa 1: Extracción de texto
        ├── PDF nativo:    pdfjs-dist (mejor que pdf-parse para PDFs complejos)
        ├── PDF escaneado: OCRmyPDF + Tesseract-PR (español con dict legal PR)
        ├── DOCX:          mammoth (mantener — funciona bien)
        └── TXT:           mantener
    → Capa 2: Extracción de estructura
        ├── Opción A (rápida): StructureDetectorService mejorado con más patrones
        └── Opción B (potente): Docling (IBM) — preservar como módulo opcional
    → Capa 3: Normalización mejorada
    → BullMQ → DocumentChunk[]
```

**Decisión clave:** No reemplazar Gemini OCR — conservarlo como Capa 4 de emergencia cuando todo lo demás falla. Las tres capas reducen su uso al mínimo (menos costo, menos latencia).

---

## FASE 1 — Mejoras Sin Dependencias Nuevas (Esta Semana)

> Impacto alto, riesgo cero. Todo dentro del código TypeScript existente.

### F1.1 — Mejorar `StructureDetectorService`

**Archivo:** `src/documents/services/structure-detector.service.ts`

Problemas actuales:
- Regex solo matcha al inicio de línea (`^`) — falla con texto concatenado
- No reconoce: Inciso, Literal, Numeral, Transitorio, Disposición, Enmienda
- No detecta títulos de sección en ALLCAPS sin keyword específica

Cambios:
1. Agregar patterns para tipos legales PR adicionales:
   - `INCISO`: `/\b(INCISO|Inciso)\s+([a-z]\)|[0-9]+[\.\)])/i`
   - `LITERAL`: `/\b(LITERAL|Literal)\s+([a-z])\b/i`
   - `NUMERAL`: `/^\s*(\d+)[\.\)]\s+[A-ZÁÉÍÓÚ]/` (línea que empieza con número)
   - `TRANSITORIO`: `/\b(DISPOSICI[ÓO]N TRANSITORIA|TRANSITORIO)\s+([IVX]+|\d+)/i`
   - `WHEREAS/POR CUANTO`: `/^POR CUANTO[:\s]/i`
   - `RESUÉLVASE/BE IT RESOLVED`: `/^(RES[UÚ]ELVASE|RESUELTA|BE IT RESOLVED)/i`
   - `EXPOSICIÓN DE MOTIVOS`: `/^EXPOSICI[ÓO]N DE MOTIVOS/i`

2. Cambiar de matching `^` estricto a multi-line con lookahead:
   - Dividir por doble-salto de línea (`\n\n`) además de por línea individual
   - Esto captura artículos que van pegados al texto del artículo anterior

3. Agregar heurística de ALLCAPS para headings (>3 palabras en mayúsculas = heading)

**Resultado esperado:** Pasar de ~60% detección a >90% en documentos legislativos de PR.

---

### F1.2 — Mejorar alineación de chunks en `CompareProcessor`

**Archivo:** `src/comparison/processors/compare.processor.ts:alignChunks()`

El fallback posicional es demasiado agresivo. Mejoras:

1. **Similaridad de contenido:** Antes del fallback posicional, intentar matching por similitud de Jaccard (bag-of-words simple, sin embeddings):
   ```
   similarity = |A ∩ B| / |A ∪ B|  (sets de palabras clave)
   threshold = 0.3
   ```

2. **Matching fuzzy de labels:** "Artículo 5" vs "Artículo 5." vs "ART. 5" — normalizar antes de comparar (quitar puntos, espacios extra, diacríticos)

3. **Chunks sin match:** En vez de ignorarlos, crear entries de `ADDED` o `REMOVED` en los chunk comparisons para que aparezcan en el diff como bloques nuevos/eliminados

**Resultado esperado:** Diffs correctos incluso cuando un documento tiene artículos reordenados o renumerados.

---

### F1.3 — Arreglar detección de texto escaneado en `FileParserService`

**Archivo:** `src/documents/services/file-parser.service.ts`

El threshold actual (`text.trim().length < 10`) es demasiado estricto. Un PDF con solo una página en blanco antes del texto real pasa el threshold pero entrega texto corrupto.

Mejoras:
1. Calcular ratio de caracteres imprimibles vs totales: si < 0.6, es texto corrupto
2. Detectar texto "basura" típico de PDF mal extraído: líneas con solo caracteres especiales
3. Agregar timeout configurable (actualmente hardcoded 60000ms) via `GEMINI_OCR_TIMEOUT_MS` env var
4. Log de calidad de extracción: palabras/página para debugging

---

## FASE 2 — Integración de pdfjs-dist (Semana 2)

> Reemplazar `pdf-parse` por `pdfjs-dist` para PDFs nativos complejos.

### Motivación

`pdf-parse` es un wrapper delgado sobre pdfjs con limitaciones:
- No maneja bien PDFs con múltiples columnas (leyes con formato 2-col)
- No extrae orden de lectura correcto en PDFs con tablas
- La API `PDFParse` nueva (v2.x) es inestable (ver `require()` workaround en el código)

`pdfjs-dist` (Mozilla PDF.js) es la implementación de referencia:
- Extrae texto preservando orden de lectura
- Maneja columnas, tablas, encabezados/pies de página
- Manejado activamente, compatible con Node.js 20+

### Implementación

**Nuevo archivo:** `src/documents/services/pdf-extractor.service.ts`

```typescript
@Injectable()
export class PdfExtractorService {
  async extract(buffer: Buffer): Promise<PdfExtractResult> {
    // pdfjs-dist con CMAP_URL + StandardFontDataUrl para fuentes embebidas
    // Iterar páginas → extraer text items con viewport coords
    // Detectar y filtrar headers/footers (texto repetido en misma posición Y)
    // Retornar: text, pageCount, hasTextLayer, qualityScore
  }
}
```

**Calidad score:**
- `qualityScore >= 0.7` → texto válido, usar directo
- `0.3 <= qualityScore < 0.7` → texto parcial, considerar OCR
- `qualityScore < 0.3` → PDF escaneado, ir a OCR pipeline

**Sin romper nada:** `FileParserService.parsePdf()` sigue siendo el entry point. Internamente delega a `PdfExtractorService` primero, luego OCR si necesario.

**Nueva dependencia:** `pdfjs-dist@^4.x` (actualmente en npm, sin compilación nativa)

```bash
npm install pdfjs-dist
```

---

## FASE 3 — OCRmyPDF + Tesseract para PDFs Escaneados (Semana 3)

> Pipeline local de OCR que reemplaza Gemini OCR para documentos de tamaño normal, reservando Gemini para emergencias.

### Por qué OCRmyPDF + Tesseract

| Aspecto | Gemini OCR | OCRmyPDF + Tesseract |
|---------|------------|----------------------|
| Costo | $0.0001/page (tokens) | $0 (local) |
| Latencia | 15-60s | 5-30s (local) |
| Límite de tamaño | ~20 páginas práctico | Sin límite |
| Privacidad | Datos salen de la red | 100% local |
| Español PR | Bueno | Excelente con tesseract-ocr-spa |
| Dependencia externa | Sí (API key, rate limits) | Solo binarios OS |

### Integración con NestJS

OCRmyPDF es una herramienta CLI de Python. La integración en NestJS es via `child_process.spawn()` en un servicio dedicado:

**Nuevo archivo:** `src/documents/services/ocr.service.ts`

```typescript
@Injectable()
export class OcrService {
  async ocrPdf(inputBuffer: Buffer, options?: OcrOptions): Promise<Buffer> {
    // 1. Escribir buffer a tmp file (mkdtemp)
    // 2. Spawn: ocrmypdf --language spa --pdf-renderer sandwich input.pdf output.pdf
    // 3. Leer output.pdf a buffer
    // 4. Limpiar tmp files
    // 5. Timeout configurable (default: 120s)
    // Retornar PDF con texto layer añadido
  }

  async isAvailable(): Promise<boolean> {
    // Verificar que ocrmypdf está en PATH
    // Si no, log warning y retornar false (graceful degradation)
  }
}
```

**Cascada OCR en `FileParserService.parsePdf()`:**
```
1. pdfjs-dist → qualityScore >= 0.7?  → usar texto
2. OcrService.isAvailable() && qualityScore < 0.7?  → ocrPdf() → pdfjs-dist
3. OcrService no disponible && GEMINI_API_KEY?  → Gemini OCR (fallback)
4. Nada disponible?  → BadRequestException descriptivo
```

### Instalación del sistema (prerequisito)

```bash
# Ubuntu/Debian (el entorno actual)
sudo apt-get install -y ocrmypdf tesseract-ocr tesseract-ocr-spa

# Verificar
ocrmypdf --version
tesseract --list-langs | grep spa
```

Esto va al `README.md` y `docs/INSTALL_GUIDE.md` como prerequisito.

### Módulo NestJS

`OcrService` se registra en `DocumentsModule`:
```typescript
providers: [
  FileParserService,
  IngestionService,
  NormalizerService,
  StructureDetectorService,
  PdfExtractorService,  // NUEVO F2
  OcrService,           // NUEVO F3
  ...
]
```

---

## FASE 4 — Docling como Módulo Opcional (Semana 4+)

> IBM Docling provee extracción de estructura de nivel superior, pero requiere Python y tiene overhead mayor.

### Qué es Docling

Docling (IBM Research) es una librería Python para extracción de documentos complejos:
- Parseo nativo de PDF con detección de layout (columnas, tablas, figuras)
- Extracción de estructura jerárquica (heading levels, lists, tables)
- Soporte de DOCX, PDF, HTML, imágenes
- Produce JSON estructurado con secciones anidadas

### Arquitectura de integración (NO bloquea el pipeline actual)

```
DoclingWorker (proceso Python separado)
    ↑ HTTP local (puerto 8099) o stdin/stdout JSON
    |
NestJS DoclingService
    ├── isAvailable(): ping /health
    ├── parse(buffer, mimeType): ParsedDocument
    └── Fallback: si no disponible → pipeline actual (Fase 1+2+3)
```

**Nuevo servicio:** `src/documents/services/docling.service.ts`

```typescript
@Injectable()
export class DoclingService {
  private readonly baseUrl = 'http://localhost:8099';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/health`, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  async parse(buffer: Buffer, mimeType: string): Promise<DoclingResult | null> {
    if (!await this.isAvailable()) return null;
    // POST multipart/form-data con el file
    // Retornar estructura jerárquica de secciones
  }
}
```

**Worker Python mínimo** (`docling-worker/main.py`):
```python
from docling.document_converter import DocumentConverter
from fastapi import FastAPI, UploadFile
import tempfile

app = FastAPI()
converter = DocumentConverter()

@app.post("/parse")
async def parse(file: UploadFile):
    with tempfile.NamedTemporaryFile(suffix='.pdf') as tmp:
        tmp.write(await file.read())
        result = converter.convert(tmp.name)
        return result.document.export_to_dict()
```

### Cuándo usar Docling vs pipeline propio

| Condición | Usar |
|-----------|------|
| Docling disponible Y doc tiene estructura compleja | Docling |
| Docling disponible Y doc es texto simple | Pipeline propio (más rápido) |
| Docling no disponible | Pipeline propio siempre |

**El pipeline propio nunca se desactiva.** Docling es una mejora opt-in.

### Instalación Docling (opcional)

```bash
pip install docling
# Iniciar worker en segundo plano
python docling-worker/main.py &
```

Variable de entorno para habilitar: `DOCLING_ENABLED=true` (default: false)

---

## Archivos a Crear/Modificar

### Fase 1 (sin dependencias nuevas)

| Archivo | Operación | Cambio |
|---------|-----------|--------|
| `src/documents/services/structure-detector.service.ts` | Editar | +7 patterns, lógica multi-line, ALLCAPS heuristic |
| `src/comparison/processors/compare.processor.ts` | Editar | alignChunks() con Jaccard similarity + label fuzzy |
| `src/documents/services/file-parser.service.ts` | Editar | qualityScore threshold, timeout configurable |

### Fase 2 (1 dependencia nueva)

| Archivo | Operación | Cambio |
|---------|-----------|--------|
| `src/documents/services/pdf-extractor.service.ts` | Crear | Extracción via pdfjs-dist |
| `src/documents/documents.module.ts` | Editar | Registrar PdfExtractorService |
| `src/documents/services/file-parser.service.ts` | Editar | Delegar a PdfExtractorService |

### Fase 3 (binarios OS)

| Archivo | Operación | Cambio |
|---------|-----------|--------|
| `src/documents/services/ocr.service.ts` | Crear | Wrapper ocrmypdf via child_process |
| `src/documents/documents.module.ts` | Editar | Registrar OcrService |
| `src/documents/services/file-parser.service.ts` | Editar | Cascada: pdfjs → ocr → gemini |
| `apps/legitwatch-comparator/.env` | Editar | `GEMINI_OCR_TIMEOUT_MS=60000` |

### Fase 4 (módulo Python separado)

| Archivo | Operación | Cambio |
|---------|-----------|--------|
| `src/documents/services/docling.service.ts` | Crear | HTTP client al worker Python |
| `docling-worker/main.py` | Crear | FastAPI + Docling |
| `docling-worker/requirements.txt` | Crear | `docling fastapi uvicorn` |
| `apps/legitwatch-comparator/.env` | Editar | `DOCLING_ENABLED=false` |

---

## Funciones Existentes que NO Tocar

| Función | Archivo | Por qué conservar |
|---------|---------|-------------------|
| `extractTextViaGeminiOcr()` | `file-parser.service.ts` | Fallback final — siempre útil |
| `generateExecutiveSummary()` | `llm-analysis.service.ts` | Funciona correctamente |
| `analyzeStakeholders()` | `llm-analysis.service.ts` | Funciona correctamente |
| `DiffService` + `DiffViewerPanel` | backend + frontend | Core del producto |
| BullMQ queues (ingestion/comparison) | processors | Arquitectura central |
| `ComparisonResult.metadata JSONB` | entity | Schema sin migración requerida |
| Caché de comparaciones completadas | `comparison.service.ts` | Evita re-trabajo |

---

## Variables de Entorno Nuevas

```env
# Fase 2 — Calidad de extracción PDF
PDF_QUALITY_THRESHOLD=0.7          # 0.0-1.0, default 0.7

# Fase 3 — OCR local
OCR_ENABLED=true                   # default: true si ocrmypdf está instalado
GEMINI_OCR_TIMEOUT_MS=60000        # timeout para Gemini OCR fallback

# Fase 4 — Docling
DOCLING_ENABLED=false              # default: false
DOCLING_URL=http://localhost:8099  # URL del worker Python
```

---

## Orden de Implementación Recomendado

```
Semana 1:
  [x] F1.1 — Mejorar StructureDetectorService (+patterns, multi-line)
  [x] F1.2 — Mejorar alignChunks() con Jaccard + fuzzy labels
  [x] F1.3 — Arreglar threshold de detección de texto escaneado

Semana 2:
  [ ] F2   — Integrar pdfjs-dist como extractor principal
  [ ] Test: Subir 5 PDFs legislativos reales y comparar calidad

Semana 3:
  [ ] F3   — Instalar ocrmypdf + tesseract-ocr-spa en el servidor
  [ ] F3   — Implementar OcrService con cascada
  [ ] Test: PDFs escaneados sin Gemini → verificar latencia y calidad

Semana 4+ (opcional, cuando el resto esté estable):
  [ ] F4   — Docling worker + DoclingService
  [ ] Test: Comparar calidad de estructura Docling vs regex
```

---

## Criterios de Éxito

| Métrica | Actual | Objetivo |
|---------|--------|---------|
| % de PDFs extraídos correctamente | ~70% | >95% |
| % de artículos detectados en leyes PR | ~60% | >90% |
| % de chunks alineados correctamente | ~50-80% | >90% |
| Uso de Gemini OCR (PDFs/semana) | 100% de PDFs | <5% (solo emergencias) |
| Tiempo de ingesta por PDF 20 pág | ~15-60s | <10s (sin OCR), <30s (con OCR local) |
| Diffs incorrectos por alineación fallida | frecuente | <5% de comparaciones |
