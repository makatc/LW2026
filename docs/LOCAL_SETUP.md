# 🚀 Guía de Deployment - LegalWatch Comparador en Antigravity

Esta guía te ayudará a integrar el nuevo **LegalWatch Comparador** con tu setup existente de Sutra (dashboard + monitor) en Antigravity.

## 📋 Configuración Final

```
✅ PostgreSQL: Compartida (misma instancia)
✅ Bases de Datos: Separadas
   - sutra_monitor (ya existe)
   - legitwatch_comparator (nueva)
✅ Redis: Compartido (misma instancia)
✅ Puertos:
   - Dashboard: 3001
   - Monitor: 3000
   - Comparador: 3002 (nuevo)
✅ Comunicación: Apps independientes
✅ Monorepo: Turborepo
```

---

## 🔄 Paso 1: Actualizar el Código desde GitHub

### 1.1 Hacer Pull del Branch Feature

```bash
# Navega a tu proyecto
cd /ruta/a/LWBETA

# Fetch todas las ramas
git fetch origin

# Mergea el feature branch a main (o haz PR en GitHub primero)
git checkout main
git pull origin main

# Verificar que el comparador existe
ls -la apps/legitwatch-comparator/
```

Si prefieres hacer PR en GitHub primero:
1. Ve a GitHub → tu repo LWBETA
2. Busca el branch `claude/setup-nestjs-project-CXpSb`
3. Crea Pull Request → Merge a main
4. Luego haz `git pull origin main`

---

## 🗄️ Paso 2: Configurar la Base de Datos

### 2.1 Crear Nueva Base de Datos para el Comparador

El comparador necesita su propia base de datos separada:

```bash
# Conéctate a PostgreSQL
docker exec -it lwbeta-postgres-1 psql -U postgres

# Dentro de psql, ejecuta:
CREATE DATABASE legitwatch_comparator;
\c legitwatch_comparator
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

O usando el script de inicialización:

```bash
# El script ya existe en scripts/init-db.sql
docker exec -i lwbeta-postgres-1 psql -U postgres < scripts/init-db.sql
```

### 2.2 Verificar las Bases de Datos

```bash
docker exec -it lwbeta-postgres-1 psql -U postgres -c "\l"
```

Deberías ver:
- `sutra_monitor` (existente)
- `legitwatch_comparator` (nueva)

---

## ⚙️ Paso 3: Configurar Variables de Entorno

### 3.1 Actualizar .env en la Raíz

Edita el archivo `.env` en la raíz del monorepo:

```env
# === Existing Sutra Config ===
SUTRA_DASHBOARD_PORT=3001
SUTRA_MONITOR_PORT=3000

# Database (Shared PostgreSQL)
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=password

# Sutra Monitor DB
SUTRA_DB_NAME=sutra_monitor

# Redis (Shared)
REDIS_HOST=localhost
REDIS_PORT=6379

# === New Comparador Config ===
COMPARADOR_PORT=3002

# Comparador DB (Separate database, same instance)
COMPARADOR_DB_NAME=legitwatch_comparator

# Dashboard API (for HttpDashboardConnector)
DASHBOARD_API_URL=http://localhost:3001/api
# DASHBOARD_API_KEY=your-api-key-if-needed

# Node Environment
NODE_ENV=development
```

### 3.2 Crear .env para el Comparador

Crea `apps/legitwatch-comparator/.env`:

```bash
cp apps/legitwatch-comparator/.env.example apps/legitwatch-comparator/.env
```

Luego edita `apps/legitwatch-comparator/.env`:

```env
# Database (uses shared PostgreSQL but separate database)
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=legitwatch_comparator

# Redis (shared)
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
NODE_ENV=development
PORT=3002

# Dashboard API (if needed to import from your Sutra Dashboard)
DASHBOARD_API_URL=http://localhost:3001/api
# DASHBOARD_API_KEY=optional-api-key

# Logging
LOG_LEVEL=info
```

---

## 📦 Paso 4: Instalar Dependencias

### 4.1 Instalar Dependencias del Comparador

```bash
# Si usas Turborepo (desde la raíz)
npm install

# O específicamente para el comparador
cd apps/legitwatch-comparator
npm install
cd ../..
```

### 4.2 Verificar Turborepo

Asegúrate que `turbo.json` en la raíz incluya el comparador:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts"]
    }
  }
}
```

---

## 🏗️ Paso 5: Ejecutar Migraciones

### 5.1 Correr Migraciones del Comparador

```bash
cd apps/legitwatch-comparator

# Ejecutar migraciones
npm run migration:run

# Verificar que las tablas se crearon
docker exec -it lwbeta-postgres-1 psql -U postgres -d legitwatch_comparator -c "\dt"
```

Deberías ver las tablas:
- `documents`
- `document_versions`
- `document_chunks`
- `source_snapshots`
- `comparison_results`

---

## 🚀 Paso 6: Levantar las Aplicaciones

### 6.1 Verificar Docker Compose

Asegúrate que `docker-compose.yml` tenga PostgreSQL y Redis corriendo:

```bash
# Verificar servicios
docker-compose ps

# Si no están corriendo, levántalos
docker-compose up -d
```

### 6.2 Levantar Todas las Apps con Turborepo

```bash
# Desde la raíz del monorepo
npm run dev
```

Esto debería levantar:
- **Sutra Dashboard** en `http://localhost:3001`
- **Sutra Monitor** en `http://localhost:3000`
- **LegalWatch Comparador** en `http://localhost:3002`

### 6.3 Levantar Solo el Comparador

Si quieres levantar solo el comparador:

```bash
cd apps/legitwatch-comparator
npm run start:dev
```

---

## ✅ Paso 7: Verificar que Todo Funciona

### 7.1 Health Check del Comparador

```bash
# Verificar que el comparador está corriendo
curl http://localhost:3002

# Expected: {"message":"Hello from LegalWatch Comparador!"}
```

### 7.2 Probar el Flujo Completo

#### Test 1: Importar desde Dashboard (Mock)

```bash
curl -X POST http://localhost:3002/import/dashboard \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "ley-organica-15-1999",
    "connectorType": "mock"
  }'
```

Expected response:
```json
{
  "success": true,
  "snapshotId": "uuid-generado",
  "message": "Imported 2 versions successfully"
}
```

#### Test 2: Ingerir Documento

```bash
curl -X POST http://localhost:3002/documents/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotId": "uuid-del-paso-anterior"
  }'
```

Expected response:
```json
{
  "jobId": "123",
  "status": "added",
  "message": "Ingestion job queued"
}
```

#### Test 3: Verificar Job Status

```bash
curl http://localhost:3002/documents/jobs/123
```

#### Test 4: Listar Documentos

```bash
curl http://localhost:3002/documents
```

---

## 🔧 Paso 8: Scripts Útiles

### 8.1 Agregar Scripts al package.json Raíz

Edita `package.json` en la raíz para agregar scripts convenientes:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "comparador:dev": "cd apps/legitwatch-comparator && npm run start:dev",
    "comparador:build": "cd apps/legitwatch-comparator && npm run build",
    "comparador:test": "cd apps/legitwatch-comparator && npm test",
    "comparador:migrate": "cd apps/legitwatch-comparator && npm run migration:run",
    "db:reset": "docker-compose down -v && docker-compose up -d && sleep 5 && npm run comparador:migrate"
  }
}
```

### 8.2 Usar los Scripts

```bash
# Desarrollo
npm run dev                    # Todas las apps
npm run comparador:dev         # Solo comparador

# Build
npm run build                  # Todas las apps
npm run comparador:build       # Solo comparador

# Testing
npm run test                   # Todas las apps
npm run comparador:test        # Solo comparador

# Database
npm run comparador:migrate     # Correr migraciones
npm run db:reset              # Reset completo de Docker + migraciones
```

---

## 🐳 Paso 9: Docker Compose (Opcional - Si quieres dockerizar el comparador)

Si quieres correr el comparador en Docker (opcional):

### 9.1 Crear Dockerfile para el Comparador

Crea `apps/legitwatch-comparator/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3002
CMD ["node", "dist/main.js"]
```

### 9.2 Agregar al docker-compose.yml

```yaml
services:
  postgres:
    # ... existente ...

  redis:
    # ... existente ...

  legitwatch-comparador:
    build:
      context: ./apps/legitwatch-comparator
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=postgres
      - DB_PASSWORD=password
      - DB_NAME=legitwatch_comparator
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - PORT=3002
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
```

---

## 🎯 Arquitectura Final

```
┌─────────────────────────────────────────────────────────┐
│                    LWBETA Monorepo                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Sutra      │  │    Sutra     │  │  LegalWatch  │  │
│  │  Dashboard   │  │   Monitor    │  │  Comparador  │  │
│  │  (Next.js)   │  │  (NestJS)    │  │  (NestJS)    │  │
│  │  Port: 3001  │  │  Port: 3000  │  │  Port: 3002  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┴─────────────────┘           │
│                           │                             │
└───────────────────────────┼─────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
   ┌────▼─────┐                          ┌─────▼─────┐
   │PostgreSQL│                          │   Redis   │
   │  Port:   │                          │ Port: 6379│
   │  5433    │                          └───────────┘
   ├──────────┤
   │ Databases│
   │ ─────────│
   │ sutra_   │
   │ monitor  │
   │          │
   │ legitwatch│
   │ comparator│
   └──────────┘
```

---

## 📝 Resumen de Comandos

```bash
# 1. Pull del código
git checkout main && git pull origin main

# 2. Setup DB
docker exec -i lwbeta-postgres-1 psql -U postgres < scripts/init-db.sql

# 3. Instalar dependencias
npm install

# 4. Configurar .env
cp apps/legitwatch-comparator/.env.example apps/legitwatch-comparator/.env
# Editar .env según la configuración arriba

# 5. Migraciones
cd apps/legitwatch-comparator && npm run migration:run && cd ../..

# 6. Levantar todo
npm run dev

# 7. Verificar
curl http://localhost:3002
```

---

## 🔍 Troubleshooting

### Problema: Puerto 3002 ya en uso
```bash
# Ver qué proceso usa el puerto
lsof -i :3002
# o
netstat -tlnp | grep 3002

# Matar el proceso
kill -9 <PID>

# O cambiar el puerto en .env
PORT=3003
```

### Problema: No puede conectar a PostgreSQL
```bash
# Verificar que PostgreSQL está corriendo
docker-compose ps

# Verificar logs
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres
```

### Problema: Migraciones fallan
```bash
# Verificar que la DB existe
docker exec -it lwbeta-postgres-1 psql -U postgres -l

# Crear manualmente si no existe
docker exec -it lwbeta-postgres-1 psql -U postgres -c "CREATE DATABASE legitwatch_comparator;"

# Reintentar migraciones
cd apps/legitwatch-comparator && npm run migration:run
```

### Problema: Redis connection refused
```bash
# Verificar Redis
docker-compose ps redis

# Verificar logs
docker-compose logs redis

# Reiniciar Redis
docker-compose restart redis
```

### Problema: BullMQ jobs no se procesan
```bash
# Verificar que Redis está accesible
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Ver las queues en Redis
redis-cli -h localhost -p 6379 KEYS "bull:*"

# Reiniciar el comparador
cd apps/legitwatch-comparator && npm run start:dev
```

---

## 🎉 ¡Listo!

El **LegalWatch Comparador** ahora está corriendo junto con tus aplicaciones Sutra en Antigravity.

### Próximos Pasos:
1. ✅ Configurar el `HttpDashboardConnector` para conectar con tu dashboard real
2. ✅ Integrar embeddings (cuando estés listo)
3. ✅ Implementar PDF generation (reemplazar el mock)
4. ✅ Agregar autenticación/autorización
5. ✅ Setup CI/CD para deploys automáticos

### URLs de Acceso:
- Dashboard: http://localhost:3001
- Monitor: http://localhost:3000
- **Comparador: http://localhost:3002** 🆕

---

**¿Necesitas ayuda?** Consulta el README.md en `apps/legitwatch-comparator/README.md` para más detalles sobre la API y el workflow completo.
