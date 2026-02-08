# Environment Variables

This document describes all environment variables used across the SUTRA Monitor system.

## Backend (`apps/sutra-monitor`)

### Database
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |

**Example:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/sutra_monitor
```

### Redis
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string for BullMQ |

**Example:**
```env
REDIS_URL=redis://localhost:6379
```

### Server
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | HTTP server port |
| `NODE_ENV` | No | `development` | Environment mode |

**Example:**
```env
PORT=3001
NODE_ENV=production
```

### Scraping (Optional)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCRAPER_HEADLESS` | No | `true` | Run Playwright in headless mode |
| `SCRAPER_TIMEOUT` | No | `30000` | Page load timeout (ms) |
| `SCRAPER_DELAY` | No | `1000` | Politeness delay between requests (ms) |

**Example:**
```env
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT=30000
SCRAPER_DELAY=1000
```

## Frontend (`apps/sutra-dashboard`)

### API
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Backend API base URL |

**Example:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

### Next.js
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Development server port |

## Database Package (`packages/db`)

### Migrations
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string for migrations |

**Example:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/sutra_monitor
```

## Docker Compose

The `docker-compose.yml` file defines:

### PostgreSQL
- **Port:** 5433 (host) → 5432 (container)
- **Database:** `sutra_monitor`
- **User:** `postgres`
- **Password:** `password`
- **Volume:** `postgres_data`

### Redis
- **Port:** 6379 (host) → 6379 (container)
- **No persistence** (in-memory only)

## Production Considerations

### Security
1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use strong passwords** - Change default PostgreSQL password
3. **Restrict database access** - Use firewall rules
4. **Use HTTPS** - Configure reverse proxy (nginx, Caddy)

### Secrets Management
For production, use:
- **Docker Secrets** (Docker Swarm)
- **Kubernetes Secrets** (K8s)
- **AWS Secrets Manager** (AWS)
- **Azure Key Vault** (Azure)
- **Environment variables** from hosting platform

### Example Production Setup

**Backend:**
```env
DATABASE_URL=postgresql://prod_user:STRONG_PASSWORD@db.example.com:5432/sutra_monitor?sslmode=require
REDIS_URL=redis://:REDIS_PASSWORD@redis.example.com:6379
PORT=3001
NODE_ENV=production
SCRAPER_HEADLESS=true
```

**Frontend:**
```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

## Validation

The application validates required environment variables at startup:
- Missing `DATABASE_URL` → Error and exit
- Invalid `REDIS_URL` → Warning, falls back to default
- Missing `NEXT_PUBLIC_API_URL` → Frontend API calls will fail

## Troubleshooting

### Database Connection Fails
```
Error: connect ECONNREFUSED 127.0.0.1:5433
```
**Solution:** Ensure Docker Compose is running: `docker-compose up -d`

### Redis Connection Fails
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Check Redis container: `docker ps | grep redis`

### Frontend Can't Reach API
```
TypeError: Failed to fetch
```
**Solution:** Verify `NEXT_PUBLIC_API_URL` matches backend URL

## Environment Templates

### `.env.example` (Backend)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/sutra_monitor
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
```

### `.env.example` (Frontend)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Copy these to `.env` and customize for your environment.
