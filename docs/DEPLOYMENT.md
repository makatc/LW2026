# Deployment Guide

This guide covers deploying SUTRA Monitor to production.

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker & Docker Compose
- Domain name (optional, for HTTPS)
- Minimum 2GB RAM, 20GB disk

## Deployment Options

### Option 1: Docker Compose (Recommended)

**Pros:**
- Simple setup
- All services containerized
- Easy to update

**Cons:**
- Single server only
- Manual scaling

### Option 2: Kubernetes

**Pros:**
- Auto-scaling
- High availability
- Multi-server

**Cons:**
- Complex setup
- Higher resource requirements

### Option 3: Platform as a Service

**Supported platforms:**
- Railway
- Render
- Fly.io
- Heroku

## Docker Compose Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Create app user
sudo useradd -m -s /bin/bash sutra
sudo usermod -aG docker sutra
```

### 2. Clone Repository

```bash
su - sutra
git clone <repository-url> /home/sutra/sutra-monitor
cd /home/sutra/sutra-monitor
```

### 3. Configure Environment

```bash
# Backend
cp apps/sutra-monitor/.env.example apps/sutra-monitor/.env
nano apps/sutra-monitor/.env
```

Update with production values:
```env
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@postgres:5432/sutra_monitor
REDIS_URL=redis://redis:6379
PORT=3001
NODE_ENV=production
```

```bash
# Frontend
cp apps/sutra-dashboard/.env.example apps/sutra-dashboard/.env
nano apps/sutra-dashboard/.env
```

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 4. Update Docker Compose

Edit `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sutra_monitor
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # Use env var
    ports:
      - "5432:5432"  # Internal only
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: apps/sutra-monitor/Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/sutra_monitor
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: apps/sutra-dashboard/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

### 5. Create Dockerfiles

**Backend Dockerfile** (`apps/sutra-monitor/Dockerfile`):
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

**Frontend Dockerfile** (`apps/sutra-dashboard/Dockerfile`):
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["pnpm", "start"]
```

### 6. Build & Deploy

```bash
# Build images
docker-compose build

# Run migrations
docker-compose run backend pnpm migrate up

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 7. Setup Nginx Reverse Proxy

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/sutra-monitor
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sutra-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Setup SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### 9. Setup Monitoring

```bash
# Install monitoring tools
docker run -d --name=prometheus -p 9090:9090 prom/prometheus
docker run -d --name=grafana -p 3001:3000 grafana/grafana
```

## Maintenance

### Updates

```bash
cd /home/sutra/sutra-monitor
git pull
docker-compose build
docker-compose up -d
```

### Backups

```bash
# Database backup
docker exec postgres pg_dump -U postgres sutra_monitor > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i postgres psql -U postgres sutra_monitor < backup_20260206.sql
```

### Logs

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rotate logs
docker-compose logs --tail=1000 backend > backend.log
```

## Troubleshooting

### Service Won't Start
```bash
docker-compose ps
docker-compose logs backend
```

### Database Connection Issues
```bash
docker exec -it postgres psql -U postgres -d sutra_monitor
\dt  # List tables
```

### High Memory Usage
```bash
docker stats
# Consider increasing server resources or optimizing queries
```

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Enable firewall (ufw)
- [ ] Setup SSL certificates
- [ ] Restrict database access
- [ ] Enable Docker security scanning
- [ ] Setup automated backups
- [ ] Configure log rotation
- [ ] Enable rate limiting
- [ ] Setup monitoring alerts

## Performance Optimization

1. **Database Indexing**
   - Add indexes on frequently queried columns
   - Monitor slow queries

2. **Caching**
   - Redis for API responses
   - CDN for static assets

3. **Scaling**
   - Horizontal: Multiple backend instances
   - Vertical: Increase server resources

---

For questions or issues, contact: [your-email@example.com]
