# LWBETA - SUTRA Monitor + LegalWatch Comparador

Monorepo integrado que combina un sistema de monitoreo legislativo automatizado con un servicio de análisis y comparación de documentos para la Oficina de Servicios Legislativos de Puerto Rico.

**Componentes:**
1. **SUTRA Monitor** — Scraping, detección y monitoreo de medidas legislativas
2. **LegalWatch Comparador** — Comparación inteligente de versiones de leyes con IA
3. **SUTRA Dashboard** — Interfaz web para usuarios

---

## 📚 Documentación

Toda la documentación técnica está en [`docs/`](./docs/):

| Documento | Descripción |
|-----------|-------------|
| [📖 INSTALL_GUIDE.md](docs/INSTALL_GUIDE.md) | Instalación paso a paso para Linux/macOS |
| [🔧 LOCAL_SETUP.md](docs/LOCAL_SETUP.md) | Setup local con Docker Compose |
| [🚀 DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment a producción |
| [🔐 AUTHENTICATION.md](docs/AUTHENTICATION.md) | JWT y autenticación |
| [⚙️ ENVIRONMENT.md](docs/ENVIRONMENT.md) | Variables de entorno |
| [📊 PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | Especificación técnica |
| [🔍 COMPARADOR_ANALYSIS.md](docs/COMPARADOR_ANALYSIS.md) | Análisis del Comparador |
| [🧹 CLEANUP_REPORT.md](docs/CLEANUP_REPORT.md) | Auditoría de limpieza |

---

## 🚀 Quick Start

```bash
# 1. Levantar infraestructura (PostgreSQL + Redis)
docker compose up -d

# 2. Instalar dependencias del comparador
cd apps/legitwatch-comparator
npm install

# 3. Configurar variables de entorno
# Ver: apps/legitwatch-comparator/.env (ajustar GROQ_API_KEY y GEMINI_API_KEY)

# 4. Ejecutar migraciones del comparador
npm run migration:run

# 5. Iniciar todos los servicios
bash ~/LWBETA/dev.sh
```

**Acceso:**
- 🌐 Dashboard: http://localhost:3000
- 🔌 Monitor API: http://localhost:3001
- 📄 Comparador API: http://localhost:3002

**Credenciales por defecto:**
- Email: `admin@legalwatch.pr`
- Password: `password`

---

## 🏗️ Arquitectura

```
LWBETA (Monorepo)
├── apps/
│   ├── sutra-dashboard/           # Next.js 14 — Frontend
│   ├── sutra-monitor/             # NestJS 11 — Scraping y monitoreo (port 3001)
│   └── legitwatch-comparator/     # NestJS 11 — Motor de comparación (port 3002)
├── packages/
│   ├── db/                        # Migraciones TypeORM (sutra-monitor)
│   ├── lw-shared-types/           # Tipos TypeScript compartidos
│   └── ...                        # Otros paquetes compartidos
├── docs/                          # Documentación técnica
├── scripts/
│   └── init-db.sql                # Inicialización de BD (crea legitwatch_comparator + extensión vector)
├── docker-compose.yml             # PostgreSQL 16 (pgvector) + Redis 7
└── dev.sh                         # Script de inicio unificado
```

**Tech Stack:**
- Backend: NestJS 11, TypeORM, BullMQ, diff-match-patch
- Frontend: Next.js 14, TailwindCSS, @tanstack/react-query, lucide-react
- DB: PostgreSQL 16 (pgvector), Redis 7
- LLM: Groq API (resúmenes), Google Gemini API (OCR de PDFs escaneados)
- Package manager: npm (en este entorno; el proyecto usa Turborepo)

**Puertos Docker (host → container):**
- PostgreSQL: `5433 → 5432`
- Redis: `6380 → 6379`

---

## ✨ Características

### SUTRA Monitor
- Scraping automático de medidas legislativas
- Detección por palabras clave
- Monitoreo de medidas con alertas
- Notificaciones por email
- Dashboard con estadísticas

### LegalWatch Comparador
- Upload de PDFs y DOCX directamente desde el dashboard
- OCR automático para PDFs escaneados (vía Gemini)
- Extracción de estructura legal (Artículos, Capítulos, Secciones)
- Diff carácter a carácter con `<ins>` / `<del>`
- Vista Redline (unificada) y Lado a Lado sincronizada
- Búsqueda integrada con highlight en tiempo real
- Detección de 12 tipos de cambios semánticos
- Resumen ejecutivo generado por IA (Groq/llama-3.1-8b-instant)
- Análisis de impacto por partes afectadas (agencias, grupos, etc.)
- Procesamiento asíncrono con BullMQ (no bloquea la UI)

---

## 🔧 Troubleshooting

**Puertos ocupados:**
```bash
lsof -i :3000,:3001,:3002
killall node
```

**Docker no disponible / instalar:**
```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl start docker
sudo usermod -aG docker $USER
# Reabrir terminal, luego:
docker compose up -d
```

**Migraciones del comparador:**
```bash
cd apps/legitwatch-comparator
npm run migration:run
```

**Redis / PostgreSQL — verificar:**
```bash
docker compose ps
docker compose logs postgres
docker compose logs redis
```

---

## 📝 Comandos Útiles

```bash
# Iniciar todo
bash ~/LWBETA/dev.sh

# Solo el comparador
cd apps/legitwatch-comparator && npm run start:dev

# Solo el dashboard
cd apps/sutra-dashboard && npm run dev

# Migraciones
cd apps/legitwatch-comparator && npm run migration:run

# Tests del comparador
cd apps/legitwatch-comparator && npm test
```

---

## 🤖 Status del Sistema

Estado actual (Marzo 2026):
- Servicios: sutra-dashboard (3000), sutra-monitor (3001), legitwatch-comparator (3002)
- Comparador MVP completo: diff, side-by-side, LLM summary, stakeholder analysis, OCR
- Docker: PostgreSQL 16 pgvector en puerto 5433, Redis 7 en puerto 6380
- LLM: Groq (resumen ejecutivo) + Gemini (OCR) — funciona con stubs si no hay keys
- Pendiente: exportación PDF real, comparación por texto pegado

---

## 📄 Licencia

Propietario — LegalWatch / Oficina de Servicios Legislativos de Puerto Rico

---

**Construido para transparencia en el proceso legislativo de Puerto Rico** 🇵🇷

**Última actualización:** Marzo 2026
