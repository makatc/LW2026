# LegalWatch Comparador 2.0

Motor de comparación legislativa para Puerto Rico. Ingiere, procesa y compara versiones de leyes, detecta cambios semánticos, genera diffs visuales y produce resúmenes ejecutivos con IA.

## 🏗️ Arquitectura

Monolito modular NestJS con los siguientes módulos:

| Módulo | Descripción |
|--------|-------------|
| **A: Dashboard Integration** | Importa documentos desde fuentes externas |
| **B: Documents & Ingestion** | Procesa archivos (PDF/DOCX) y extrae chunks estructurales |
| **C: Common** | Logger Pino, utilidades compartidas |
| **D: Comparison Engine** | Compara versiones, genera diffs, detecta cambios semánticos |
| **E: Reports** | Exporta resultados y resúmenes enriquecidos |

### Tech Stack

- **Framework**: NestJS 11 (TypeScript strict)
- **Base de datos**: PostgreSQL 16 con pgvector
- **Cola/Async**: Redis + BullMQ
- **ORM**: TypeORM con migraciones
- **Logging**: Pino
- **Diff**: Google's diff-match-patch
- **Parsing**: pdf-parse (PDF), mammoth (DOCX)
- **OCR**: Google Gemini API (PDFs escaneados sin texto extraíble)
- **LLM**: Groq API — llama-3.1-8b-instant (resumen ejecutivo + análisis de impacto)

---

## 📋 Requisitos

- Node.js 20+
- Docker + Docker Compose (para PostgreSQL y Redis)
- npm

---

## 🚀 Quick Start

### 1. Levantar infraestructura

```bash
# Desde la raíz del monorepo
docker compose up -d
```

Esto levanta:
- **PostgreSQL 16** en el host puerto **5433** (con pgvector, crea `legitwatch_comparator` automáticamente)
- **Redis 7** en el host puerto **6380**

### 2. Instalar dependencias

```bash
cd apps/legitwatch-comparator
npm install
```

### 3. Configurar variables de entorno

El archivo `.env` ya existe. Ajustar las API keys opcionales:

```env
# Base de datos (Puerto host de Docker)
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=legitwatch_comparator

# Redis (Puerto host de Docker)
REDIS_HOST=localhost
REDIS_PORT=6380

# Aplicación
NODE_ENV=development
PORT=3002

# LLM — opcionales (el app funciona con stubs si no están configuradas)
GROQ_API_KEY=         # Resumen ejecutivo + análisis de impacto → https://console.groq.com/keys
GEMINI_API_KEY=       # OCR de PDFs escaneados → https://aistudio.google.com/apikey

# Integración con dashboard (modo mock por defecto)
DASHBOARD_CONNECTOR_MODE=mock
DASHBOARD_API_URL=http://localhost:3001
DASHBOARD_API_KEY=your-api-key-here
```

### 4. Ejecutar migraciones

```bash
npm run migration:run
```

Crea las tablas: `documents`, `document_versions`, `document_chunks`, `source_snapshots`, `comparison_results`.

### 5. Iniciar el servicio

```bash
# Desarrollo (watch mode)
npm run start:dev

# Producción
npm run build && npm run start:prod
```

API disponible en `http://localhost:3002`

---

## 🔄 Flujo completo: Upload → Ingerir → Comparar → Reporte

### Desde el Frontend (Dashboard)

1. Ir a http://localhost:3000/comparator
2. Subir **Ley Vigente** (PDF o DOCX)
3. Subir **Propuesta** (PDF o DOCX)
4. Clic en **Comparar**
5. Esperar procesamiento asíncrono (polling automático)
6. Ver resultados en 3 tabs:
   - **Resumen Ejecutivo** — generado por IA
   - **Cambios Detectados** — diff Redline o Lado a Lado sincronizado con búsqueda
   - **Análisis de Impacto** — partes afectadas con direccionalidad y proyección temporal

### Desde la API (curl)

#### Upload de archivo

```bash
curl -X POST http://localhost:3002/documents/upload \
  -F "file=@mi-ley.pdf" \
  -F "title=Ley Orgánica 15/1999" \
  -F "versionTag=vigente"
```

#### Comparar dos versiones

```bash
curl -X POST http://localhost:3002/comparison/compare \
  -H "Content-Type: application/json" \
  -d '{
    "sourceVersionId": "uuid-version-1",
    "targetVersionId": "uuid-version-2",
    "detectSemanticChanges": true
  }'
```

#### Obtener resultado

```bash
curl http://localhost:3002/comparison/results/{comparisonId}
curl http://localhost:3002/projects/{comparisonId}/summary
```

---

## 📊 Endpoints API

### Upload / Documentos
- `POST /documents/upload` — Subir archivo (PDF, DOCX, TXT)
- `POST /documents/ingest` — Encolar procesamiento de snapshot
- `GET /documents/jobs/:jobId` — Estado del job
- `GET /documents/:documentId` — Detalle de documento
- `GET /documents/:documentId/versions` — Versiones del documento

### Importación (desde dashboard externo)
- `POST /import/dashboard` — Importar ley desde fuente externa

### Comparación
- `POST /comparison/compare` — Encolar job de comparación
- `GET /comparison/jobs/:jobId` — Estado del job
- `GET /comparison/results/:comparisonId` — Resultado de comparación
- `GET /comparison/queue/stats` — Estadísticas de la cola

### Reportes
- `GET /projects/:comparisonId/summary` — Resumen enriquecido con IA
- `GET /projects/:comparisonId/export` — Exportar PDF (mock)
- `GET /projects/:comparisonId/result` — Resultado crudo

---

## ✨ Funcionalidades clave

### Parsing y OCR
- **PDF**: `pdf-parse` para texto extraíble; fallback a **Gemini multimodal** para PDFs escaneados
- **DOCX**: `mammoth` para extracción de texto
- **Normalización**: elimina headers, footers, números de página y artefactos de PDF

### Detección de estructura legal
Detecta automáticamente estructuras en español:
- `ARTÍCULO` / `Art.`
- `CAPÍTULO`
- `SECCIÓN`
- `PÁRRAFO`

### Detección de 12 tipos de cambios semánticos
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

### Generación de diffs
- Diff carácter a carácter con `<ins>` / `<del>`
- HTML unificado (Redline) y HTML lado a lado (sourceSideHtml / targetSideHtml)
- Similarity score (0–100%)
- Impact score ponderado por tipo semántico

### IA (opcional — funciona con stubs si no hay keys)
- **Resumen ejecutivo** (`GROQ_API_KEY`): Groq API con llama-3.1-8b-instant — explica qué cambió y por qué importa
- **Análisis de impacto** (`GROQ_API_KEY`): identifica partes afectadas, direccionalidad (positivo/restrictivo/mixto), proyección temporal
- **OCR** (`GEMINI_API_KEY`): Gemini 2.0 Flash para PDFs escaneados sin texto extraíble

---

## 🗄️ Esquema de base de datos

```
documents
  └── document_versions
        └── document_chunks (con embedding vector)

source_snapshots → document / document_versions (referencia)

comparison_results → document_version (source + target)
  metadata JSONB → aiSummary, stakeholderAnalysis, títulos
```

---

## 🏗️ Estructura del proyecto

```
apps/legitwatch-comparator/
├── src/
│   ├── common/                    # Logger Pino, utilidades
│   ├── dashboard-integration/     # Módulo A: Conectores de importación
│   │   ├── connectors/
│   │   │   ├── mock-dashboard.connector.ts
│   │   │   └── http-dashboard.connector.ts
│   │   ├── dashboard-import.service.ts
│   │   └── dashboard-import.controller.ts
│   ├── documents/                 # Módulo B: Ingesta y procesamiento
│   │   ├── services/
│   │   │   ├── file-parser.service.ts      # PDF/DOCX + OCR Gemini
│   │   │   ├── structure-detector.service.ts
│   │   │   ├── normalizer.service.ts
│   │   │   └── ingestion.service.ts
│   │   ├── processors/
│   │   │   └── ingestion.processor.ts
│   │   └── documents.controller.ts
│   ├── comparison/                # Módulo D: Motor de comparación
│   │   ├── services/
│   │   │   ├── diff.service.ts
│   │   │   ├── comparison.service.ts
│   │   │   └── llm-analysis.service.ts     # Resumen + stakeholders (Groq)
│   │   ├── processors/
│   │   │   └── compare.processor.ts        # Genera diff unificado + side-by-side
│   │   └── comparison.controller.ts
│   ├── reports/                   # Módulo E: Reportes
│   │   ├── reports.service.ts
│   │   └── reports.controller.ts
│   ├── entities/                  # TypeORM entities
│   │   ├── document.entity.ts
│   │   ├── document-version.entity.ts
│   │   ├── document-chunk.entity.ts
│   │   ├── source-snapshot.entity.ts
│   │   └── comparison-result.entity.ts    # chunkComparisons incluye sourceSideHtml/targetSideHtml
│   ├── migrations/
│   └── app.module.ts
├── test/
├── .env                           # DB_PORT=5433, REDIS_PORT=6380
├── docker-compose.yml             # Solo infra (postgres + redis)
└── package.json
```

---

## 🧪 Testing

```bash
npm test                  # Unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage
```

Cobertura actual: **46 tests** en 5 test suites.

---

## 🔧 Scripts de desarrollo

```bash
npm run start:dev          # Desarrollo con watch
npm run build              # Build producción
npm run start:prod         # Iniciar build

npm run migration:generate # Generar migración
npm run migration:run      # Ejecutar migraciones
npm run migration:revert   # Revertir última migración

npm run lint               # ESLint
npm run format             # Prettier
```

---

## 🐳 Comandos Docker

```bash
# Desde la raíz del monorepo
docker compose up -d                    # Levantar postgres + redis
docker compose ps                       # Ver estado
docker compose logs -f                  # Ver logs
docker compose down                     # Detener

# Acceder a PostgreSQL
docker exec -it lwbeta-postgres-1 psql -U postgres -d legitwatch_comparator

# Acceder a Redis CLI
docker exec -it lwbeta-redis-1 redis-cli -p 6380
```

---

## 🔒 Seguridad

- No commitear `.env` con keys reales
- Usar variables de entorno para todos los secrets
- TypeORM usa queries parametrizadas (previene SQL injection)
- Sanitizar HTML generado (XSS prevention)

---

## 📝 Pendiente

- [ ] Exportación real a PDF (actualmente mock)
- [ ] Tab "Comparar por texto" (pegar texto directamente)
- [ ] Migración formal de BD para campos `aiSummary` / `stakeholderAnalysis` (hoy en `metadata` JSONB)
- [ ] WebSocket/SSE para job status (reemplazar polling)
- [ ] Búsqueda de leyes relacionadas (`GET /documents/:id/related`)
- [ ] Swagger/OpenAPI documentation

---

## 📄 Licencia

Propietario — LegalWatch Comparador 2.0
