# Análisis de Capacidades — LegalWatch Comparador

Estado actual del comparador (Marzo 2026). Implementado como MVP funcional completo.

---

## Módulo A: Dashboard Integration

**Capacidad:** Importar leyes desde fuentes externas.

- Strategy Pattern (Mock/HTTP Connectors)
- SHA256 deduplication
- SourceSnapshot tracking

**Estado:**
- ✅ Importar desde API externa (`connectorType: "http"`)
- ✅ Mock para desarrollo (`connectorType: "mock"`)
- ✅ Deduplicación automática por SHA256
- ✅ Tracking de múltiples versiones

**Endpoint:** `POST /import/dashboard`

---

## Módulo B: Documents & Ingestion

**Capacidad:** Procesar archivos y detectar estructura legal.

- BullMQ (async job processing)
- pdf-parse + mammoth para extracción de texto
- **Gemini 2.0 Flash** como OCR fallback para PDFs escaneados
- Regex para detección de estructura legal en español
- Normalización de texto (artefactos de PDF, headers, footers)

**Estado:**
- ✅ Upload directo de PDF y DOCX (`POST /documents/upload`)
- ✅ OCR automático vía Gemini para PDFs escaneados (requiere `GEMINI_API_KEY`)
- ✅ Procesamiento asíncrono con BullMQ (no bloquea la UI)
- ✅ Detección de estructura: ARTÍCULO, CAPÍTULO, SECCIÓN, PÁRRAFO
- ✅ Normalización de texto
- ✅ División en chunks estructurales
- ✅ Job status tracking (polling)

**Endpoints:**
- `POST /documents/upload` — Upload multipart de archivo
- `POST /documents/ingest` — Encolar procesamiento de snapshot
- `GET /documents/jobs/:jobId` — Estado del job
- `GET /documents/:documentId` — Detalle del documento
- `GET /documents/:documentId/versions` — Versiones

---

## Módulo D: Compare Engine

**Capacidad:** Comparar versiones, generar diffs, detectar cambios semánticos.

- Google's diff-match-patch (diffs carácter a carácter)
- Generación de HTML unificado (Redline) Y HTML lado a lado (side-by-side)
- Detección semántica de 12 tipos de cambios
- BullMQ para jobs asincrónicos
- Scoring de impacto ponderado por tipo

**Estado:**
- ✅ Diff HTML unificado con `<ins>` / `<del>`
- ✅ Diff lado a lado (`sourceSideHtml` + `targetSideHtml`) — sincronizado en frontend
- ✅ Similarity scoring (0–100%)
- ✅ Detección de 12 tipos de cambios semánticos (ver lista abajo)
- ✅ Impact score ponderado por categoría
- ✅ Comparación chunk a chunk con alignment map
- ✅ Fetch de versiones con datos de documento (títulos)

**12 tipos de cambios semánticos:**
1. `OBLIGATION_SHIFT` — "deberá" → "podrá"
2. `SANCTION_CHANGED` — cambios en multas/penas
3. `DEFINITION_MODIFIED` — cambios en definiciones
4. `SCOPE_EXPANSION` — ampliación de alcance
5. `SCOPE_REDUCTION` — reducción de alcance
6. `TEMPORAL_CHANGE` — cambios en plazos/fechas
7. `QUANTITATIVE_CHANGE` — cambios numéricos
8. `ENTITY_AFFECTED` — cambios en entidades afectadas
9. `REQUIREMENT_ADDED` — nuevos requisitos
10. `REQUIREMENT_REMOVED` — requisitos eliminados
11. `PROCEDURAL_CHANGE` — cambios en procedimientos
12. `OTHER` — otros cambios

**Endpoints:**
- `POST /comparison/compare` — Encolar job de comparación
- `GET /comparison/jobs/:jobId` — Estado del job
- `GET /comparison/results/:comparisonId` — Resultado con diffs y cambios semánticos

---

## Módulo E: Reports + LLM Analysis

**Capacidad:** Resúmenes con IA y exportación de resultados.

- **Groq API** (llama-3.1-8b-instant) para resumen ejecutivo y análisis de impacto
- Análisis de stakeholders guardado en `metadata` JSONB
- Fallback automático a stubs si no hay `GROQ_API_KEY`

**Estado:**
- ✅ Resumen ejecutivo generado por IA (Groq)
- ✅ Análisis de stakeholders: entidades afectadas, direccionalidad, proyección temporal
- ✅ ProjectSummary con metadata enriquecida
- ✅ Export PDF (mock — respuesta estructurada, sin generación real de PDF)
- ⏳ Generación real de PDF (pendiente)

**Endpoints:**
- `GET /projects/:comparisonId/summary` — Resumen enriquecido con IA
- `GET /projects/:comparisonId/export` — Export PDF (mock)
- `GET /projects/:comparisonId/result` — Resultado crudo

---

## Frontend — DiffViewerPanel y ImpactAnalysisPanel

### DiffViewerPanel (`src/components/comparator/DiffViewerPanel.tsx`)
- Toggle **Redline** (diff unificado) / **Lado a Lado** (side-by-side)
- Scroll sincronizado entre paneles izquierdo y derecho
- Búsqueda integrada con highlight en tiempo real en ambos paneles
- Chunks colapsables con etiquetas de tipo de cambio y color coding
- Botón "Ver más" para mostrar todos los chunks (10 por defecto)

### ImpactAnalysisPanel (`src/components/comparator/ImpactAnalysisPanel.tsx`)
- Tarjetas por entidad agrupadas por tipo (agencia, corporación, grupo demográfico, etc.)
- Indicadores de impacto: positivo / restrictivo / neutro / mixto
- Proyección temporal expandible (corto / mediano / largo plazo)
- Banner de impacto general con resumen

### Página del Comparador (`src/app/(dashboard)/comparator/page.tsx`)
- Labels: "Ley Vigente" (source) / "Propuesta" (target)
- Envía `detectSemanticChanges: true` al backend
- 3 tabs de resultados: **Resumen Ejecutivo** | **Cambios Detectados** | **Análisis de Impacto**
- Stats: impact score, secciones cambiadas, expansiones, cambios críticos
- Polling automático de jobs hasta completar o fallar

---

## Flujo completo

```
1. UPLOAD
   ↓
   POST /documents/upload (PDF/DOCX)
   → Extrae texto (pdf-parse / mammoth / OCR Gemini)
   → Crea Document + DocumentVersion + SourceSnapshot

2. INGEST
   ↓
   BullMQ Job: Normalizar → Detectar Estructura → Crear Chunks
   → Polling GET /documents/jobs/:id

3. COMPARE
   ↓
   POST /comparison/compare { sourceVersionId, targetVersionId, detectSemanticChanges: true }
   → BullMQ Job:
     - Alinear chunks
     - Generar diffHtml + sourceSideHtml + targetSideHtml
     - Detectar 12 tipos de cambios semánticos
     - Llamar a Groq: resumen ejecutivo + stakeholder analysis
   → Polling GET /comparison/jobs/:id

4. REPORT
   ↓
   GET /projects/:comparisonId/summary
   → Retorna: diffs + cambios semánticos + impact score + aiSummary + stakeholderAnalysis
```

---

## Pendiente

- [ ] Exportación real a PDF (actualmente mock)
- [ ] Tab "Comparar por texto pegado" en el frontend
- [ ] Migración formal de BD para `aiSummary` / `stakeholderAnalysis` (hoy en `metadata` JSONB)
- [ ] WebSocket/SSE para job status (reemplazar polling)
- [ ] Endpoint `GET /documents/:id/related` para leyes relacionadas
- [ ] Swagger/OpenAPI documentation
- [ ] Integración con embeddings pgvector para búsqueda semántica
