# sutra-monitor

Servicio NestJS de scraping legislativo para Puerto Rico. Extrae medidas, legisladores, comisiones, votaciones y texto de proyectos desde SUTRA (oslpr.org), senado.pr.gov y camara.pr.gov.

**Puerto por defecto:** `3003` (configurable con `PORT`)

---

## Índice

- [Arquitectura](#arquitectura)
- [Scrapers](#scrapers)
- [Pipeline](#pipeline)
- [Schedule (Cron)](#schedule-cron)
- [API Endpoints](#api-endpoints)
- [Variables de entorno](#variables-de-entorno)
- [Setup local](#setup-local)
- [Tests](#tests)
- [Estructura de archivos](#estructura-de-archivos)

---

## Arquitectura

```
sutra-monitor
├── Scrapers (src/scrapers/)          ← extracción + limpieza + versionado
│   ├── legislators/                  ← senado.pr.gov + camara.pr.gov
│   ├── committees/                   ← comisiones + membresía
│   ├── bills/                        ← SUTRA medidas (Playwright)
│   ├── votes/                        ← votaciones por medida (Playwright)
│   ├── bill-text/                    ← PDF → texto (pdf-parse + Gemini OCR)
│   ├── pipeline/                     ← orquestador completo
│   ├── scheduler/                    ← @Cron fallback (sin Redis)
│   └── change-event/                 ← eventos de cambio (DB + EventEmitter)
│
├── Queues (src/queues/)              ← BullMQ workers (requiere Redis)
│
└── API (src/modules/api/)            ← REST endpoints consumidos por dashboard
```

**Modo dual de scheduling:**
- **Con Redis** → BullMQ distribuye los jobs entre workers
- **Sin Redis** → `ScraperSchedulerService` usa `@nestjs/schedule` (cron local)

La selección es automática via `REDIS_HOST`/`REDIS_URL`, o forzable con `SCRAPER_CRON_ENABLED`.

---

## Scrapers

### LegislatorsScraper

Extrae legisladores de ambas cámaras.

- **Fuentes:** `senado.pr.gov/senadores/`, `camara.pr.gov/representantes/`
- **Tecnología:** axios + cheerio
- **Datos:** nombre, cámara, partido, distrito, email, teléfono, oficina, foto
- **Versionado:** hash SHA-256 del registro — INSERT en nuevo, UPDATE si cambia
- **Dedup:** por `(chamber, full_name)`

### CommitteesScraper

Extrae comisiones y membresía.

- **Fuentes:** `senado.pr.gov/comisiones/`, `camara.pr.gov/comisiones/`
- **Tecnología:** axios + cheerio
- **Datos:** nombre, cámara, tipo (standing/special/joint/conference), presidente, miembros
- **Membresía:** vincula `legislators` vía name-matching (exacto → apellido)
- **Refresh:** DELETE + re-INSERT de membresías en cada ejecución

### BillsScraper

Extrae medidas legislativas desde SUTRA.

- **Fuente:** `sutra.oslpr.org/medidas`
- **Tecnología:** Playwright (Chromium headless) — SPA con paginación dinámica
- **Datos:** número, título, tipo (PS/PC/RS/RC/…), estado, comisión, autores, acciones, PDF URL
- **Límites:** `SUTRA_MAX_PAGES` páginas de lista, `BILL_DETAIL_LIMIT` páginas de detalle
- **Versionado:** hash SHA-256 — INSERT o UPDATE por `numero`

| Prefijo | Tipo |
|---|---|
| PS, PC | `bill` (proyecto) |
| RS, RC, RCS, RCC, RN | `resolution` |
| OA | `other` |

### VotesScraper

Extrae votaciones desde las páginas de detalle de medidas.

- **Fuente:** páginas individuales de `sutra_measures.source_url`
- **Tecnología:** Playwright
- **Datos:** resultado (pass/fail), conteos (a favor/contra/abstención), votos individuales por legislador
- **Dedup:** hash de `(numero, fecha, motion_text)`
- **Error handling:** falla silenciosamente (votos son opcionales en el pipeline)

### BillTextScraper

Extrae texto de los PDFs de proyectos.

- **Fuente:** `sutra_measures` con `source_url` que apunta a PDF
- **Extracción:** 2 capas:
  1. `pdf-parse` (texto nativo)
  2. Gemini 2.0 Flash OCR (PDFs escaneados, requiere `GEMINI_API_KEY`)
- **Versionado:** hash SHA-256 del texto → nueva `bill_version` si cambia
- **Error handling:** falla silenciosamente (texto es enriquecimiento opcional)

---

## Pipeline

`PipelineService` orquesta los 5 scrapers en secuencia:

```
Legislators → Committees → Bills → Votes → BillText
```

- `runFull()` — pipeline completo
- `runSingle(name)` — ejecuta un scraper individual (`'legislators'`, `'committees'`, `'bills'`, `'votes'`, `'bill-text'`)

Cada scraper registra su ejecución en `scraper_runs` (estado, conteos, errores, duración).

### Eventos de cambio

Cuando un scraper detecta un INSERT o UPDATE, emite un `ChangeEvent`:

```
bill.created     | bill.updated
legislator.created | legislator.updated
committee.created  | committee.updated
vote.created
bill_version.created | bill_version.updated
```

Los eventos se persisten en `change_events` y se emiten como eventos Node.js (`EventEmitter`) para listeners in-process (p.ej. notificaciones, webhooks).

---

## Schedule (Cron)

| Scraper | Expresión | Frecuencia |
|---|---|---|
| legislators | `0 6 * * *` | Diario a las 6:00 AM |
| committees | `30 6 * * *` | Diario a las 6:30 AM |
| bills | `0 */2 * * *` | Cada 2 horas |
| votes | `0 */4 * * *` | Cada 4 horas |
| bill-text | `0 2 * * *` | Diario a las 2:00 AM |
| full pipeline | `0 3 * * 0` | Domingos a las 3:00 AM |

**Auto-enable:** el scheduler cron se activa automáticamente si no hay `REDIS_HOST` ni `REDIS_URL` configurados. Puede forzarse con `SCRAPER_CRON_ENABLED=true/false`.

---

## API Endpoints

Base URL: `http://localhost:3003`

### Medidas (Bills)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/bills` | Lista medidas con filtros |
| `GET` | `/api/bills/summary` | Conteos por tipo y estado |
| `GET` | `/api/bills/:id` | Detalle de una medida (con versiones y votos) |

**Query params de `/api/bills`:**
- `bill_type` — `bill` \| `resolution` \| `other`
- `status` — texto libre (ej. `En trámite`)
- `commission` — nombre o ID de comisión
- `author` — nombre del autor
- `search` — búsqueda en `numero` y `titulo`
- `limit` — default 50
- `offset` — default 0

### Legisladores

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/legislators` | Lista legisladores (filtros: `chamber`, `party`) |

### Comisiones

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/committees` | Lista comisiones |

### Votaciones

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/votes/:billId` | Votaciones de una medida |

### Eventos de cambio

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/change-events` | Eventos recientes (filtros: `entity_type`, `limit`, `since`) |
| `GET` | `/api/change-events/stats` | Conteos por tipo (últimos 7 días) |

### Scraper (admin)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/scraper/trigger` | Lanza scraper manual (`body: { scraper: 'bills' }`) |
| `GET` | `/api/scraper/status` | Estado de queues y últimas ejecuciones |

### Health

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio |

---

## Variables de entorno

Crear un archivo `.env` en `apps/sutra-monitor/`:

```env
# ── Base de datos (requerido) ───────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/legalwatch

# ── Puerto ─────────────────────────────────────────────────────────────
PORT=3003

# ── Redis / BullMQ (opcional) ──────────────────────────────────────────
# Si no se configura, el app corre en modo cron-only (sin queues distribuidas)
REDIS_HOST=localhost
REDIS_PORT=6379
# O alternativamente:
# REDIS_URL=redis://localhost:6379

# ── Scheduler ──────────────────────────────────────────────────────────
# true  → fuerza cron local activo (aunque haya Redis)
# false → desactiva cron local (aunque no haya Redis)
# omitido → auto: activo si no hay Redis, inactivo si hay Redis
SCRAPER_CRON_ENABLED=

# ── OCR de PDFs escaneados (opcional) ──────────────────────────────────
# Sin esta key, bill-text extrae solo PDFs con texto nativo (pdf-parse)
GEMINI_API_KEY=

# ── Límites de scraping ─────────────────────────────────────────────────
SUTRA_MAX_PAGES=50          # Máximo de páginas a paginar en SUTRA (default: 50)
BILL_DETAIL_LIMIT=100       # Máximo de detalles de medidas a cargar (default: 100)
SCRAPER_RATE_LIMIT_MS=2000  # Delay entre requests HTTP (default: 2000ms)
```

---

## Setup local

### Prerrequisitos

- Node.js 20+
- PostgreSQL 14+
- (Opcional) Redis 7+
- (Opcional) Playwright Chromium: `npm run install:browsers`

### Instalación

```bash
cd apps/sutra-monitor
npm install

# Instalar Chromium para Playwright (necesario para bills y votes)
npm run install:browsers
```

### Migrar base de datos

Desde la raíz del monorepo:

```bash
cd packages/db
DATABASE_URL=postgresql://... npm run migrate:up
```

Esto aplica todas las migraciones incluyendo las tablas nuevas:
- `legislators`, `committees`, `committee_memberships`
- `votes`, `individual_votes`
- `bill_versions`, `scraper_runs`
- `change_events`

### Ejecutar en desarrollo

```bash
cd apps/sutra-monitor
npm run dev
```

El servidor arranca en `http://localhost:3003`.

### Trigger manual de scrapers

```bash
# Lanzar todos los scrapers
curl -X POST http://localhost:3003/api/scraper/trigger \
  -H "Content-Type: application/json" \
  -d '{"scraper": "all"}'

# Lanzar solo bills
curl -X POST http://localhost:3003/api/scraper/trigger \
  -H "Content-Type: application/json" \
  -d '{"scraper": "bills"}'
```

---

## Tests

```bash
cd apps/sutra-monitor

# Todos los tests
npm test

# Solo scrapers
npx jest --testPathPatterns="scrapers"

# Solo scheduler
npx jest --testPathPatterns="scheduler"

# Con cobertura
npx jest --coverage
```

**Cobertura actual:** 113 tests en 8 suites

| Suite | Tests | Cubre |
|---|---|---|
| `legislators.scraper.spec.ts` | 14 | Scraping, hash-dedup, normalización, party, detail enrichment |
| `committees.scraper.spec.ts` | 14 | Scraping, type detection, membership linking, error isolation |
| `bills.scraper.spec.ts` | 16 | Playwright mock, bill types, versioning, error por-bill |
| `votes.scraper.spec.ts` | 15 | Playwright mock, dedup, votos individuales, normalización de fechas |
| `bill-text.scraper.spec.ts` | 13 | pdf-parse mock, Gemini OCR fallback, new/updated/unchanged |
| `change-event.service.spec.ts` | 14 | record(), getRecent(), getStats(), EventEmitter, fallos no-críticos |
| `scraper-scheduler.spec.ts` | 17 | Enable/disable, concurrencia, error isolation, per-scraper dispatch |
| `utils.spec.ts` | 10 | Utilidades generales |

---

## Estructura de archivos

```
apps/sutra-monitor/src/
├── app.module.ts
├── main.ts
├── scrapers/
│   ├── base-scraper.ts               ← interface BaseScraper + PipelineResult
│   ├── scraper-http.client.ts        ← axios con retry y rate limiting
│   ├── scraper-run.recorder.ts       ← escribe en scraper_runs
│   ├── scrapers.module.ts
│   ├── legislators/
│   │   ├── legislators.scraper.ts
│   │   ├── legislators.module.ts
│   │   └── __tests__/legislators.scraper.spec.ts
│   ├── committees/
│   │   ├── committees.scraper.ts
│   │   ├── committees.module.ts
│   │   └── __tests__/committees.scraper.spec.ts
│   ├── bills/
│   │   ├── bills.scraper.ts
│   │   ├── bills.module.ts
│   │   └── __tests__/bills.scraper.spec.ts
│   ├── votes/
│   │   ├── votes.scraper.ts
│   │   ├── votes.module.ts
│   │   └── __tests__/votes.scraper.spec.ts
│   ├── bill-text/
│   │   ├── bill-text.scraper.ts
│   │   ├── bill-text.module.ts
│   │   └── __tests__/bill-text.scraper.spec.ts
│   ├── pipeline/
│   │   ├── pipeline.service.ts
│   │   └── pipeline.module.ts
│   ├── scheduler/
│   │   ├── scraper-scheduler.service.ts
│   │   ├── scraper-scheduler.module.ts
│   │   └── __tests__/scraper-scheduler.spec.ts
│   └── change-event/
│       ├── change-event.service.ts
│       ├── change-event.module.ts
│       ├── change-event.types.ts
│       └── __tests__/change-event.service.spec.ts
├── queues/
│   ├── index.ts                      ← definición de colas BullMQ
│   └── workers.ts                    ← workers que llaman al pipeline
├── modules/
│   ├── api/
│   │   ├── bills/                    ← GET /api/bills
│   │   ├── legislators/              ← GET /api/legislators
│   │   ├── committees/               ← GET /api/committees
│   │   ├── votes/                    ← GET /api/votes/:billId
│   │   ├── change-events/            ← GET /api/change-events
│   │   └── scraper/                  ← POST /api/scraper/trigger
│   ├── database/                     ← DatabaseService (wrapper pg Pool)
│   └── queue/                        ← QueueModule (BullMQ + schedule)
└── database-migration.service.ts     ← seed de comisiones oficiales
```
