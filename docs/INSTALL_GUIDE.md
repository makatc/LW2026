# Guía de Instalación — LWBETA

Instrucciones para instalar y ejecutar el sistema completo en **Linux Debian/Ubuntu** o **macOS**.

---

## 1️⃣ Instalar Node.js (v20+)

### En Debian/Ubuntu:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### En macOS (con Homebrew):
```bash
brew install node
```

### Verificar:
```bash
node --version   # v20.0.0 o superior
npm --version    # 10+
```

---

## 2️⃣ Instalar Docker

El proyecto usa Docker Compose para levantar PostgreSQL y Redis.

### En Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Cerrar y reabrir la terminal para que el grupo docker aplique
```

### En macOS:
Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Verificar:
```bash
docker --version
docker compose version
```

---

## 3️⃣ Clonar el repositorio e instalar dependencias

```bash
cd ~
git clone <REPO_URL> LWBETA
cd LWBETA

# Instalar dependencias del comparador
cd apps/legitwatch-comparator
npm install
cd ../..

# Instalar dependencias del dashboard (si se va a desarrollar)
cd apps/sutra-dashboard
npm install
cd ../..
```

---

## 4️⃣ Levantar la infraestructura Docker

```bash
# Desde la raíz del monorepo
docker compose up -d
```

Esto levanta:
- **PostgreSQL 16** (pgvector) — host puerto **5433**
  - Crea `sutra_monitor` automáticamente
  - El script `scripts/init-db.sql` crea `legitwatch_comparator` y habilita `pgvector`
- **Redis 7** — host puerto **6380**

Verificar:
```bash
docker compose ps
```

---

## 5️⃣ Configurar variables de entorno

### Comparador (`apps/legitwatch-comparator/.env`)

El archivo ya existe. Asegurarse de que los puertos sean los correctos:

```env
DB_HOST=localhost
DB_PORT=5433          # Puerto HOST de Docker (no el del container)
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=legitwatch_comparator

REDIS_HOST=localhost
REDIS_PORT=6380        # Puerto HOST de Docker (no el del container)

NODE_ENV=development
PORT=3002

# Opcionales — el app funciona con stubs si no están configuradas
GROQ_API_KEY=          # Resumen ejecutivo + análisis de impacto
GEMINI_API_KEY=        # OCR de PDFs escaneados
```

Obtener las keys:
- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/apikey

### Dashboard (`apps/sutra-dashboard/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COMPARATOR_API=http://localhost:3002
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

### Monitor (`apps/sutra-monitor/.env`)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/sutra_monitor
REDIS_URL=redis://localhost:6380
PORT=3001
NODE_ENV=development
```

---

## 6️⃣ Ejecutar migraciones del comparador

```bash
cd apps/legitwatch-comparator
npm run migration:run
```

Crea las tablas: `documents`, `document_versions`, `document_chunks`, `source_snapshots`, `comparison_results`.

Verificar:
```bash
docker exec -it lwbeta-postgres-1 psql -U postgres -d legitwatch_comparator -c "\dt"
```

---

## 7️⃣ Iniciar todos los servicios

```bash
bash ~/LWBETA/dev.sh
```

Levanta los 3 servicios en background:
- Dashboard → http://localhost:3000
- Monitor API → http://localhost:3001
- Comparador API → http://localhost:3002

**Acceso:**
- Email: `admin@legalwatch.pr`
- Password: `password`

---

## ✅ Checklist de verificación

- [ ] `docker compose ps` — postgres y redis corriendo
- [ ] `npm run migration:run` en `apps/legitwatch-comparator` — sin errores
- [ ] Dashboard visible en http://localhost:3000
- [ ] Comparador responde en http://localhost:3002/health (o endpoint raíz)
- [ ] Upload de PDF en el comparador funciona
- [ ] Comparación completa sin errores de conexión

---

## 🚨 Troubleshooting

### "connection refused" a PostgreSQL
```bash
docker compose ps            # Verificar que esté corriendo
docker compose logs postgres # Ver logs
docker compose restart postgres
```

### "connection refused" a Redis
```bash
docker compose ps
docker compose logs redis
docker compose restart redis
```

### Puerto incorrecto en .env
El `.env` debe usar los puertos **host** de Docker:
- `DB_PORT=5433` (no 5432)
- `REDIS_PORT=6380` (no 6379)

### Puertos de app ya en uso
```bash
lsof -i :3000,:3001,:3002
killall node
```

### Error de migraciones
```bash
# Verificar que la BD existe
docker exec -it lwbeta-postgres-1 psql -U postgres -l

# Crear manualmente si no existe
docker exec -it lwbeta-postgres-1 psql -U postgres \
  -c "CREATE DATABASE legitwatch_comparator;"

# Reintentar
cd apps/legitwatch-comparator && npm run migration:run
```

### BullMQ jobs no se procesan
```bash
# Verificar Redis accesible
docker exec -it lwbeta-redis-1 redis-cli ping
# Expected: PONG
```

---

**Última actualización: Marzo 2026**
