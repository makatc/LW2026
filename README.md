# LWBETA - SUTRA Monitor + LegalWatch Comparador

Monorepo integrado que combina un sistema de monitoreo legislativo automatizado con un servicio de análisis y comparación de documentos para la Oficina de Servicios Legislativos de Puerto Rico.

**Componentes:**
1. **SUTRA Monitor** - Scraping, detección y monitoreo de medidas legislativas
2. **LegalWatch Comparador** - Análisis, comparación y extracción de documentos
3. **SUTRA Dashboard** - Interfaz web para usuarios

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
| [🧹 CLEANUP_REPORT.md](docs/CLEANUP_REPORT.md) | Auditoría de limpieza (archivos eliminados) |

---

## 🚀 Quick Start

```bash
# 1. Instalar dependencias
npm install -g pnpm@10
pnpm install

# 2. Configurar BD y variables (.env)
# Ver: docs/INSTALL_GUIDE.md

# 3. Ejecutar migraciones
export DATABASE_URL=postgresql://postgres:password@localhost:5432/sutra_monitor
cd packages/db && pnpm exec typeorm migration:run

# 4. Iniciar servicios
bash ~/LWBETA/dev.sh
```

**Acceso:**
- 🌐 Dashboard: http://localhost:3000
- 🔌 Monitor API: http://localhost:3001
- 📄 Comparador: http://localhost:3002

**Credenciales por defecto:**
- Email: `admin@legalwatch.pr`
- Password: `password`

---

## 🏗️ Arquitectura

```
LWBETA (Monorepo)
├── apps/
│   ├── sutra-dashboard/           # Next.js - Frontend
│   ├── sutra-monitor/             # NestJS - Backend (scrapers)
│   └── legitwatch-comparator/     # NestJS - Análisis de docs
├── packages/
│   ├── db/                        # Migraciones TypeORM
│   ├── lw-auth/                   # Autenticación
│   └── ...
└── docs/                          # Documentación técnica
```

**Tech Stack:**
- Backend: NestJS, Playwright, BullMQ, TypeORM
- Frontend: Next.js 14, React, TailwindCSS  
- DB: PostgreSQL 12+ (pgvector), Redis 6+
- PM: pnpm, Turborepo

---

## ✨ Características

### SUTRA Monitor
✅ Scraping automático de medidas  
✅ Detección por palabras clave  
✅ Monitoreo de medidas  
✅ Notificaciones por email  
✅ Dashboard con estadísticas  

### LegalWatch Comparador
✅ Carga de PDFs  
✅ Extracción de texto  
✅ Análisis de documentos  
✅ Comparación de versiones  
✅ API RESTful  

---

## 📦 Estructura del Proyecto

```
LWBETA/
├── apps/
│   ├── sutra-monitor/          # NestJS backend
│   ├── sutra-dashboard/        # Next.js frontend
│   └── legitwatch-comparator/  # NestJS service
├── packages/                   # Librerías compartidas
│   ├── db/                     # BD y migraciones
│   ├── lw-auth/                # Autenticación
│   ├── lw-storage/             # Almacenamiento
│   ├── lw-shared-types/        # Tipos TypeScript
│   └── ...
├── docs/                       # Documentación técnica
├── scripts/                    # Utilidades dev
├── docker-compose.yml          # Infraestructura Docker
├── dev.sh                      # Script de inicio
└── pnpm-workspace.yaml         # Configuración monorepo
```

---

## 🔧 Troubleshooting

**Puertos ocupados:**
```bash
lsof -i :3000,:3001,:3002
killall node
```

**Base de datos:**
```bash
sudo systemctl status postgresql
redis-cli ping  # Debe responder PONG
```

**Migraciones:**
```bash
cd packages/db
pnpm exec typeorm migration:run
```

👉 Ver más en [docs/INSTALL_GUIDE.md](docs/INSTALL_GUIDE.md#-troubleshooting)

---

## 📝 Comandos Útiles

```bash
# Desarrollo
bash ~/LWBETA/dev.sh                          # Iniciar todo
npm run dev                                   # Turborepo

# Build
pnpm build                                    # Build all
pnpm --filter sutra-monitor build            # Build específico

# Testing
pnpm test                                     # Unit tests
pnpm test:e2e                                # E2E tests

# Database
export DATABASE_URL=...
cd packages/db && pnpm exec typeorm migration:run
```

---

## 🤖 Status del Sistema

Estado actual (Marzo 2026):
- ✅ Todos los servicios inicializan correctamente
- ✅ Archivos subidos y procesados sin errores
- ✅ PDFs parseados con detección de errores
- ✅ Documentos duplicados manejados gracefully
- ✅ Auto-restart de servicios fallidos
- ✅ Documentación consolidada en `docs/`

---

## 👥 Contribuir

1. Crear feature branch
2. Hacer cambios
3. Ejecutar tests: `pnpm test`
4. Build: `pnpm build`
5. Hacer PR

---

## 📄 Licencia

[Tu Licencia]

---

**Construido para transparency en el proceso legislativo de Puerto Rico** 🇵🇷

**Última actualización:** Marzo 2026
