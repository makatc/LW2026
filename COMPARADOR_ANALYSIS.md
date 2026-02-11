# 📊 Análisis de Capacidades del Comparador - LegalWatch

## 🎯 Tecnologías y Procesos Implementados

### 1️⃣ **Module A: Dashboard Integration**
**Capacidad:** Importar leyes desde fuentes externas

**Tecnologías:**
- Strategy Pattern (Mock/HTTP Connectors)
- SHA256 Deduplication
- SourceSnapshot tracking

**Lo que puede hacer:**
- ✅ Importar leyes desde API externa
- ✅ Guardar metadata de leyes
- ✅ Detectar duplicados automáticamente
- ✅ Tracking de múltiples versiones

**Endpoint:** `POST /import/dashboard`

---

### 2️⃣ **Module B: Documents & Ingestion**
**Capacidad:** Procesar documentos y detectar estructura legal

**Tecnologías:**
- BullMQ (async job processing)
- Regex Pattern Matching (estructuras legales españolas)
- Text Normalization (limpieza de PDF artifacts)

**Lo que puede hacer:**
- ✅ Procesar documentos async (no bloquea UI)
- ✅ Detectar estructura automática:
  - ARTÍCULO / Art.
  - CAPÍTULO
  - SECCIÓN
  - PÁRRAFO
- ✅ Normalizar texto (eliminar headers/footers/page numbers)
- ✅ Dividir en chunks estructurales
- ✅ Job status tracking en tiempo real

**Endpoints:**
- `POST /documents/ingest` - Queue processing job
- `GET /documents/jobs/:jobId` - Check job status
- `GET /documents/:documentId` - Get document
- `GET /documents/:documentId/versions` - List versions

---

### 3️⃣ **Module D: Compare Engine**
**Capacidad:** Comparar versiones y detectar cambios

**Tecnologías:**
- Google's diff-match-patch (character-level diffs)
- Semantic Change Detection (12 tipos)
- BullMQ (async comparison jobs)
- Chunk alignment algorithms

**Lo que puede hacer:**
- ✅ Generar diffs HTML con `<ins>` y `<del>` tags
- ✅ Side-by-side comparison view
- ✅ Similarity scoring (0-100%)
- ✅ Detectar 12 tipos de cambios semánticos:
  1. **OBLIGATION_SHIFT** - "deberá" → "podrá"
  2. **SANCTION_CHANGED** - Cambios en multas/penas
  3. **DEFINITION_MODIFIED** - Cambios en definiciones
  4. **SCOPE_EXPANSION** - Ampliación de alcance
  5. **SCOPE_REDUCTION** - Reducción de alcance
  6. **TEMPORAL_CHANGE** - Cambios en plazos/fechas
  7. **QUANTITATIVE_CHANGE** - Cambios numéricos
  8. **ENTITY_AFFECTED** - Cambios en entidades afectadas
  9. **REQUIREMENT_ADDED** - Nuevos requisitos
  10. **REQUIREMENT_REMOVED** - Requisitos eliminados
  11. **PROCEDURAL_CHANGE** - Cambios en procedimientos
  12. **OTHER** - Otros cambios
- ✅ Impact scoring (weighted by semantic type)
- ✅ Chunk-by-chunk comparison
- ✅ Alignment map (qué chunk cambió a qué)

**Endpoints:**
- `POST /comparison/compare` - Queue comparison job
- `GET /comparison/jobs/:jobId` - Check job status
- `GET /comparison/results/:comparisonId` - Get comparison result

---

### 4️⃣ **Module E: Reports**
**Capacidad:** Exportar y visualizar resultados

**Tecnologías:**
- Enriched summaries with metadata
- PDF export (mock - ready for implementation)

**Lo que puede hacer:**
- ✅ Generar resumen ejecutivo
- ✅ Incluir metadata de documentos
- ✅ Listar todos los cambios por chunk
- ✅ Mostrar impact score total
- ✅ Export to PDF (pendiente implementación real)

**Endpoints:**
- `GET /projects/:comparisonId/summary` - Get enriched summary
- `GET /projects/:comparisonId/export` - Export to PDF (mock)
- `GET /projects/:comparisonId/result` - Get raw result

---

## 🔄 Flujo Completo Actual

```
1. IMPORT
   ↓
   Usuario/API → POST /import/dashboard
   ↓
   Se crea SourceSnapshot + Document + DocumentVersions

2. INGEST
   ↓
   POST /documents/ingest
   ↓
   BullMQ Job: Normalizar → Detectar Estructura → Crear Chunks
   ↓
   GET /documents/jobs/:id (polling para status)

3. COMPARE
   ↓
   POST /comparison/compare (source + target version IDs)
   ↓
   BullMQ Job: Alinear chunks → Generar diffs → Detectar cambios semánticos
   ↓
   GET /comparison/jobs/:id (polling para status)

4. REPORT
   ↓
   GET /projects/:comparisonId/summary
   ↓
   Muestra: diffs HTML + cambios semánticos + impact score
```

---

## 🎨 Requisitos del Frontend (según user)

### Funcionalidades Requeridas:

#### 1. **Upload de Múltiples Formatos**
- ✅ Word (.doc, .docx)
- ✅ PDF (.pdf)
- ✅ Text (.txt)
- ✅ Otros formatos de texto

**Backend actual:** ❌ No soporta upload directo de archivos
**Solución:** Implementar endpoint `POST /documents/upload` que:
- Acepte multipart/form-data
- Extraiga texto de Word/PDF usando librerías
- Llame internamente a `/import/dashboard` o cree directamente el documento

#### 2. **Comparación de Documentos**
- Documento subido vs Documento subido
- Documento subido vs Ley del dashboard
- Enmienda vs Ley original (auto-detect)

**Backend actual:** ✅ Soporta comparación de versiones existentes
**Gap:** Necesita upload de archivos primero

#### 3. **Integración con Dashboard**
- Botón "Comparar" en cada medida/proyecto
- Arrastrar medidas al comparador (drag & drop)
- Buscar ley original si es enmienda

**Backend actual:** ✅ Ya tiene importación de dashboard
**Gap:** Necesita endpoints para buscar leyes relacionadas

#### 4. **Calendario** (futuro app)
- Botón "Añadir Calendario" en medidas
- Guardar eventos de vistas/fechas importantes

**Backend actual:** ❌ No existe
**Solución:** Próxima fase (no parte de este task)

---

## 📐 Arquitectura del Frontend Propuesta

### Estructura de Componentes:

```
ComparatorPage/
├── Header (título + descripción)
├── SourceSelector
│   ├── UploadTab
│   │   └── FileUploader (drag & drop + click)
│   └── DashboardTab
│       ├── SearchBox (buscar leyes)
│       ├── WatchlistPicker
│       └── ProjectPicker
├── TargetSelector (mismo que SourceSelector)
├── ComparisonConfig
│   ├── ComparisonMode (full/chunks/semantic)
│   ├── SemanticFilters (qué tipos de cambios mostrar)
│   └── AdvancedOptions
├── ActionBar
│   ├── CompareButton
│   ├── SaveButton
│   └── ExportButton
├── ResultsPanel
│   ├── SummaryCard (impact score, total changes)
│   ├── SemanticChangesPanel (agrupado por tipo)
│   ├── DiffViewer
│   │   ├── SideBySide mode
│   │   └── Inline mode
│   └── ChunkNavigator (navegar por chunks)
└── JobStatusModal (polling de jobs async)
```

---

## 🎯 Gaps a Implementar en Backend

### Alta Prioridad:
1. **File Upload Endpoint**
   - `POST /documents/upload`
   - Acepta: multipart/form-data
   - Procesa: Word, PDF, TXT
   - Devuelve: documentId

2. **Search Endpoint**
   - `GET /documents/search?q=ley+organica`
   - Busca en títulos y metadata
   - Devuelve: lista de documentos

3. **Related Laws Endpoint**
   - `GET /documents/:id/related`
   - Detecta si es enmienda y busca ley original
   - Devuelve: ley relacionada

### Media Prioridad:
4. **Quick Compare Endpoint**
   - `POST /comparison/quick`
   - Acepta: raw text (sin necesidad de ingest previo)
   - Útil para comparaciones rápidas

5. **WebSocket/SSE para Job Status**
   - Reemplazar polling con real-time updates

---

## 📋 Plan de Implementación por Fases

### **FASE 1:** Análisis y Setup ✅ (ESTA FASE)
- Análisis de capacidades
- Diseño de arquitectura
- Identificación de gaps

### **FASE 2:** Backend - File Upload & Search
- Implementar upload endpoint
- Implementar search endpoint
- Integrar librerías de parsing (PDF, Word)

### **FASE 3:** Frontend - Source/Target Selectors
- Componente FileUploader
- Componente DashboardPicker
- Integración con backend

### **FASE 4:** Frontend - Comparison & Results
- ResultsPanel con diffs
- Semantic changes visualization
- Export functionality

### **FASE 5:** Integración con Dashboard
- Botón "Comparar" en medidas
- Drag & drop desde watchlist
- Link directo a comparador

---

## 🎨 Diseño UI/UX Propuesto

### Paleta de Colores (semántica):
```css
/* Cambios Semánticos */
--obligation-shift: #EF4444 (rojo)
--sanction-changed: #F59E0B (amarillo)
--definition-modified: #8B5CF6 (morado)
--scope-expansion: #10B981 (verde)
--scope-reduction: #F97316 (naranja)
--temporal-change: #3B82F6 (azul)
--requirement-added: #059669 (verde oscuro)
--requirement-removed: #DC2626 (rojo oscuro)

/* Diff Colors */
--added: #D1FAE5 (verde claro)
--removed: #FEE2E2 (rojo claro)
--unchanged: #F3F4F6 (gris claro)
```

### Layout:
- **Desktop:** 3 columnas (Source | Actions | Target)
- **Mobile:** Stack vertical con tabs
- **Results:** Full width con side-by-side diff

---

## 📊 Métricas que Puede Generar:

1. **Impact Score** (0-100)
2. **Similarity Percentage** (0-100%)
3. **Total Changes Count**
4. **Changes by Semantic Type** (breakdown)
5. **Chunks Modified** (%)
6. **Longest Unchanged Section**
7. **Most Impactful Change**

---

## 🚀 Próximos Pasos

¿Deseas que proceda con:
- **FASE 2:** Implementar backend (upload, search, related laws)?
- **FASE 3:** Implementar frontend (selectors y UI)?
- **Ambas en paralelo?**

Confirma para continuar con la siguiente fase! 🎯
