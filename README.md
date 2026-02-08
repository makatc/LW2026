# SUTRA Monitor

Sistema automatizado de monitoreo legislativo para el Sistema Unificado de Trámite y Archivo (SUTRA) de la Oficina de Servicios Legislativos de Puerto Rico.

## 📋 Descripción

SUTRA Monitor es una aplicación full-stack que:
- **Scrapes** automáticamente medidas legislativas del portal SUTRA
- **Detecta** medidas relevantes basadas en palabras clave y temas configurables
- **Monitorea** cambios en medidas específicas (watchlist)
- **Notifica** sobre actualizaciones importantes
- **Visualiza** actividad legislativa en un dashboard interactivo

## 🏗️ Arquitectura

### Monorepo Structure
```
LWBETA/
├── apps/
│   ├── sutra-monitor/      # Backend NestJS
│   └── sutra-dashboard/    # Frontend Next.js
├── packages/
│   ├── db/                 # Database client & migrations
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Shared utilities
└── docker-compose.yml      # PostgreSQL + Redis
```

### Tech Stack

**Backend:**
- NestJS (Node.js framework)
- Playwright (web scraping)
- BullMQ (job queuing)
- PostgreSQL (database)
- Redis (caching & queues)

**Frontend:**
- Next.js 14 (React framework)
- TailwindCSS (styling)
- TypeScript

**Infrastructure:**
- Docker Compose
- pnpm workspaces

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Installation

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd LWBETA
   pnpm install
   ```

2. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

3. **Run Migrations**
   ```bash
   cd packages/db
   pnpm migrate up
   ```

4. **Seed Database (Optional)**
   ```bash
   node packages/db/seed.js
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd apps/sutra-monitor
   pnpm start:dev

   # Terminal 2: Frontend
   cd apps/sutra-dashboard
   pnpm dev
   ```

6. **Access Applications**
   - Dashboard: http://localhost:3000
   - API: http://localhost:3001
   - Health Check: http://localhost:3001/health

## 📦 Environment Variables

### Backend (`apps/sutra-monitor/.env`)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/sutra_monitor
REDIS_URL=redis://localhost:6379
PORT=3001
```

### Frontend (`apps/sutra-dashboard/.env`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🔧 Configuration

### Keywords & Topics
Configure detection keywords via the dashboard:
1. Navigate to **Configuration** → **Keywords**
2. Add keywords (e.g., "inteligencia artificial", "energía renovable")
3. Keywords are normalized (accents removed, lowercase) for matching

### Commissions
Follow specific legislative commissions:
1. Navigate to **Configuration** → **Commissions**
2. Select commissions to monitor
3. All measures from these commissions will be flagged

### Watchlist
Track specific measures:
1. **By Number**: Enter measure number (e.g., "P. del S. 1420")
2. **From Discovery**: Add from detected measures
3. Receive updates when measures change

## 🤖 Automated Jobs

Jobs run automatically via BullMQ:

| Job | Frequency | Description |
|-----|-----------|-------------|
| **Ingestion** | Every 6 hours | Scrapes latest measures from SUTRA |
| **Discovery** | Every 12 hours | Matches measures against keywords/topics |
| **Tracking** | Every 4 hours | Checks watchlist for updates |

### Manual Execution

Trigger jobs manually via API:
```bash
# Trigger ingestion
curl -X POST http://localhost:3001/ingest/trigger

# Check health
curl http://localhost:3001/health
```

## 📊 Database Schema

### Core Tables
- `sutra_measures` - Legislative measures
- `sutra_commissions` - Legislative commissions
- `measure_events` - Timeline events for measures
- `watchlist_items` - User-tracked measures
- `discovery_hits` - Keyword/topic matches
- `ingest_runs` - Scraping job history

### Key Features
- **Idempotent upserts** - Safe to re-run scraping
- **Change detection** - Hash-based diffing
- **Pending resolution** - Add measures before they're scraped

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

## 📝 API Endpoints

### Public Endpoints
- `GET /health` - System health check
- `GET /commissions` - List all commissions
- `GET /dashboard/summary` - Dashboard metrics

### Configuration
- `GET /config/keywords` - List keywords
- `POST /config/keywords` - Add keyword
- `DELETE /config/keywords/:id` - Remove keyword
- `POST /config/watchlist/by-number` - Add measure by number

### Admin
- `POST /ingest/trigger` - Manual scraping trigger

## 🛠️ Development

### Build
```bash
# Build all packages
pnpm build

# Build specific app
pnpm --filter sutra-monitor build
```

### Migrations
```bash
cd packages/db

# Create migration
pnpm migrate create <migration-name>

# Run migrations
pnpm migrate up

# Rollback
pnpm migrate down
```

### Debugging

**Check scraper output:**
```bash
tail -f apps/sutra-monitor/server_*.log
```

**Inspect database:**
```bash
docker exec -it <postgres-container> psql -U postgres -d sutra_monitor
```

**Monitor Redis queues:**
```bash
docker exec -it <redis-container> redis-cli
> KEYS *
> LLEN bull:ingest:wait
```

## 🚨 Error Handling

### NEEDS_MANUAL Status
If scraper is blocked (CAPTCHA, rate limit), jobs will:
1. Mark run as `NEEDS_MANUAL`
2. Log warning with details
3. Retry with exponential backoff

**Resolution:**
- Check `ingest_runs` table for error details
- Manually verify SUTRA website accessibility
- Adjust scraping frequency if needed

## 📈 Monitoring

### Health Checks
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T01:14:15.535Z",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### Job Status
Query `ingest_runs` table:
```sql
SELECT * FROM ingest_runs ORDER BY created_at DESC LIMIT 10;
```

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run tests: `pnpm test`
4. Build: `pnpm build`
5. Submit PR

## 📄 License

[Your License Here]

## 🙋 Support

For issues or questions:
- Open GitHub issue
- Contact: [your-email@example.com]

---

**Built with ❤️ for transparency in Puerto Rico's legislative process**
