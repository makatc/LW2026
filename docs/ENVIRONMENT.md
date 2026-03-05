# Variables de Entorno — LWBETA

Variables de entorno usadas en cada app del monorepo.

---

## Comparador (`apps/legitwatch-comparator/.env`)

### Base de datos
| Variable | Requerida | Valor por defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `DB_HOST` | Sí | `localhost` | Host de PostgreSQL |
| `DB_PORT` | Sí | `5433` | Puerto **host** de Docker (container usa 5432) |
| `DB_USERNAME` | Sí | `postgres` | Usuario de PostgreSQL |
| `DB_PASSWORD` | Sí | `password` | Contraseña |
| `DB_NAME` | Sí | `legitwatch_comparator` | Base de datos |

### Redis
| Variable | Requerida | Valor por defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `REDIS_HOST` | Sí | `localhost` | Host de Redis |
| `REDIS_PORT` | Sí | `6380` | Puerto **host** de Docker (container usa 6379) |

### Aplicación
| Variable | Requerida | Valor por defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `PORT` | No | `3002` | Puerto HTTP del comparador |
| `NODE_ENV` | No | `development` | Entorno |

### LLM (opcionales — funciona con stubs si no están)
| Variable | Requerida | Descripción | Dónde obtener |
|----------|-----------|-------------|---------------|
| `GROQ_API_KEY` | No | Resumen ejecutivo + análisis de impacto por partes (llama-3.1-8b-instant) | https://console.groq.com/keys |
| `GEMINI_API_KEY` | No | OCR de PDFs escaneados sin texto (gemini-2.0-flash) | https://aistudio.google.com/apikey |

### Integración con Dashboard
| Variable | Requerida | Valor por defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `DASHBOARD_CONNECTOR_MODE` | No | `mock` | `mock` o `http` |
| `DASHBOARD_API_URL` | No | `http://localhost:3001` | URL del Monitor API |
| `DASHBOARD_API_KEY` | No | — | API key si el Monitor requiere autenticación |
| `DASHBOARD_API_TIMEOUT` | No | `30000` | Timeout en ms |
| `DASHBOARD_API_MAX_RETRIES` | No | `3` | Reintentos en caso de fallo |

**Ejemplo `.env` completo:**
```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=legitwatch_comparator

REDIS_HOST=localhost
REDIS_PORT=6380

NODE_ENV=development
PORT=3002

GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...

DASHBOARD_CONNECTOR_MODE=mock
DASHBOARD_API_URL=http://localhost:3001
DASHBOARD_API_KEY=your-api-key-here
DASHBOARD_API_TIMEOUT=30000
DASHBOARD_API_MAX_RETRIES=3
```

---

## Monitor Backend (`apps/sutra-monitor/.env`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL connection string |
| `REDIS_URL` | No | Redis URL para BullMQ (default: `redis://localhost:6380`) |
| `PORT` | No | Puerto HTTP (default: `3001`) |
| `NODE_ENV` | No | Entorno |
| `SCRAPER_HEADLESS` | No | Playwright headless (default: `true`) |
| `SCRAPER_TIMEOUT` | No | Timeout de página en ms (default: `30000`) |
| `SCRAPER_DELAY` | No | Delay entre requests en ms (default: `1000`) |

**Ejemplo:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/sutra_monitor
REDIS_URL=redis://localhost:6380
PORT=3001
NODE_ENV=development
```

---

## Dashboard Frontend (`apps/sutra-dashboard/.env.local`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_API_URL` | Sí | URL del Monitor API |
| `NEXT_PUBLIC_COMPARATOR_API` | Sí | URL del Comparador API |
| `NEXTAUTH_SECRET` | Sí | Secreto para NextAuth |
| `NEXTAUTH_URL` | Sí | URL base del dashboard |

**Ejemplo:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COMPARATOR_API=http://localhost:3002
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

---

## Docker Compose (infraestructura)

Puertos configurados en `docker-compose.yml`:

| Servicio | Puerto host | Puerto container | Notas |
|----------|-------------|------------------|-------|
| PostgreSQL 16 (pgvector) | **5433** | 5432 | Crea `sutra_monitor`; `init-db.sql` crea `legitwatch_comparator` |
| Redis 7 | **6380** | 6379 | Sin persistencia (in-memory) |

> ⚠️ Los `.env` de las apps deben usar los puertos **host** (5433 y 6380), no los de container.

---

## Consideraciones de producción

- Nunca commitear `.env` con keys reales
- Usar secrets management (Docker Secrets, AWS Secrets Manager, etc.)
- Cambiar las contraseñas por defecto de PostgreSQL
- Configurar `sslmode=require` en `DATABASE_URL` para producción
- Las variables `GROQ_API_KEY` y `GEMINI_API_KEY` son opcionales — el sistema funciona con respuestas stub si no están configuradas
