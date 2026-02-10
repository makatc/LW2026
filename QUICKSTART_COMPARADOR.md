# ⚡ Quick Start - LegalWatch Comparador

Guía rápida para levantar el comparador en 5 minutos.

## 🎯 TL;DR

```bash
# 1. Pull del código
git pull origin main

# 2. Ejecutar script de setup automático
./scripts/setup-comparador.sh

# 3. Levantar el comparador
cd apps/legitwatch-comparator && npm run start:dev

# 4. Probar
curl http://localhost:3002
```

¡Listo! 🚀

---

## 📝 Paso a Paso Manual

### 1️⃣ Actualizar Código

```bash
git checkout main
git pull origin main
```

### 2️⃣ Setup Automático

```bash
# Desde la raíz del proyecto
./scripts/setup-comparador.sh
```

Este script:
- ✅ Verifica Docker (PostgreSQL y Redis)
- ✅ Crea la base de datos `legitwatch_comparator`
- ✅ Copia el archivo .env
- ✅ Instala dependencias
- ✅ Ejecuta migraciones

### 3️⃣ Configurar Variables (Opcional)

Edita `apps/legitwatch-comparator/.env` si necesitas cambiar algo:

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=legitwatch_comparator

REDIS_HOST=localhost
REDIS_PORT=6379

PORT=3002
NODE_ENV=development
```

### 4️⃣ Levantar el App

**Opción A: Solo el comparador**
```bash
cd apps/legitwatch-comparator
npm run start:dev
```

**Opción B: Todas las apps (Turborepo)**
```bash
npm run dev
```

### 5️⃣ Verificar

```bash
# Health check
curl http://localhost:3002

# Debería devolver:
# {"message":"Hello from LegalWatch Comparador!"}
```

---

## 🧪 Probar el Workflow Completo

### Test 1: Import (Mock Data)

```bash
curl -X POST http://localhost:3002/import/dashboard \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "ley-organica-15-1999",
    "connectorType": "mock"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Imported 2 versions successfully"
}
```

### Test 2: Ingerir Documento

Usa el `snapshotId` del paso anterior:

```bash
curl -X POST http://localhost:3002/documents/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Respuesta esperada:**
```json
{
  "jobId": "1",
  "status": "added",
  "message": "Ingestion job queued"
}
```

### Test 3: Check Job Status

```bash
curl http://localhost:3002/documents/jobs/1
```

Espera hasta que `status: "completed"`

### Test 4: Comparar Versiones

Primero obtén los IDs de las versiones:

```bash
curl http://localhost:3002/documents
```

Luego compara dos versiones:

```bash
curl -X POST http://localhost:3002/comparison/compare \
  -H "Content-Type: application/json" \
  -d '{
    "sourceVersionId": "version-uuid-1",
    "targetVersionId": "version-uuid-2"
  }'
```

### Test 5: Ver Resultado de Comparación

```bash
curl http://localhost:3002/projects/COMPARISON_UUID/summary
```

---

## 🎨 URLs de las Apps

| App | URL | Puerto |
|-----|-----|--------|
| Sutra Dashboard | http://localhost:3001 | 3001 |
| Sutra Monitor | http://localhost:3000 | 3000 |
| **LegalWatch Comparador** | **http://localhost:3002** | **3002** |

---

## 🆘 Troubleshooting

### Error: Puerto 3002 en uso

```bash
# Ver qué lo está usando
lsof -i :3002

# Cambiar puerto en .env
echo "PORT=3003" >> apps/legitwatch-comparator/.env
```

### Error: Cannot connect to database

```bash
# Verificar que PostgreSQL está corriendo
docker-compose ps

# Reiniciar PostgreSQL
docker-compose restart postgres

# Verificar que la DB existe
docker exec lwbeta-postgres-1 psql -U postgres -l | grep legitwatch
```

### Error: Redis connection refused

```bash
# Verificar Redis
docker-compose ps redis

# Reiniciar
docker-compose restart redis

# Test
docker exec lwbeta-redis-1 redis-cli ping
```

### Reiniciar Todo

```bash
# Stop todo
docker-compose down

# Start fresh
docker-compose up -d

# Re-run setup
./scripts/setup-comparador.sh
```

---

## 📚 Documentación Completa

- **DEPLOYMENT.md**: Guía completa de deployment
- **apps/legitwatch-comparator/README.md**: Documentación de la API
- **ANTIGRAVITY_QUESTIONS.md**: Configuración de Antigravity

---

## ✅ Checklist Final

- [ ] Git pull completado
- [ ] Docker corriendo (PostgreSQL + Redis)
- [ ] Base de datos `legitwatch_comparator` creada
- [ ] Archivo .env configurado
- [ ] Dependencias instaladas
- [ ] Migraciones ejecutadas
- [ ] App corriendo en puerto 3002
- [ ] Health check exitoso
- [ ] Test de import funcionando

---

**🎉 ¡Todo listo! El comparador está funcionando.**

Para más detalles sobre la API y el workflow completo, revisa:
`apps/legitwatch-comparator/README.md`
