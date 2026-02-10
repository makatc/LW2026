# Prompt para Antigravity - Setup del Comparador

Hola! Tengo un monorepo con dos aplicaciones NestJS:

1. **Dashboard** (ya deployado en Antigravity, funcionando)
2. **LegalWatch Comparador** (nuevo, recién creado en branch `claude/setup-nestjs-project-CXpSb`)

El comparador está en: `apps/legitwatch-comparator/`

Necesito que me hagas TODAS las preguntas necesarias para crear una guía de deployment completa. Aquí está mi contexto:

## Lo que ya tengo:
- Dashboard funcionando en Antigravity con Docker y todo configurado
- PostgreSQL y Redis en docker-compose
- Nuevo app "comparador" en GitHub (branch `claude/setup-nestjs-project-CXpSb`)

## Lo que necesito hacer:
- Hacer pull del nuevo código desde GitHub
- Configurar el comparador para que funcione junto con el dashboard
- Levantar ambas apps correctamente

---

## Por favor pregúntame sobre:

### 1. Configuración Actual de Docker
- ¿Cómo está estructurado mi `docker-compose.yml` actual?
- ¿Qué servicios tengo corriendo? (postgres, redis, dashboard, otros?)
- ¿Qué puertos están en uso?
- ¿Las credenciales de DB que uso actualmente?

### 2. Base de Datos
- ¿El comparador debe usar la misma PostgreSQL que el dashboard o una separada?
- ¿El comparador debe usar el mismo Redis que el dashboard o uno separado?
- ¿Cómo se llama mi base de datos actual?
- ¿Necesito crear una nueva base de datos o usar la existente?

### 3. Estructura del Monorepo
- ¿Dónde está mi dashboard? (`apps/dashboard/` o similar?)
- ¿Tengo un `docker-compose.yml` en la raíz del monorepo o dentro de cada app?
- ¿Uso Turborepo, Nx, o solo un package.json en la raíz?

### 4. Networking entre Apps
- ¿El comparador necesita llamar al dashboard por API?
- ¿El dashboard necesita llamar al comparador?
- ¿O son completamente independientes?
- ¿Qué puerto usa el dashboard actualmente?

### 5. Variables de Entorno
- ¿Tengo un archivo `.env` en la raíz o cada app tiene el suyo?
- ¿Qué variables de entorno usa actualmente el dashboard?
- ¿Antigravity maneja las variables de entorno de alguna forma especial?

### 6. Deployment en Antigravity
- ¿Cómo deploya Antigravity? (docker-compose up, scripts custom, CI/CD?)
- ¿Tengo que hacer algo especial para que Antigravity detecte el nuevo app?
- ¿Hay algún archivo de configuración especial de Antigravity?
- ¿Cómo se manejan las migraciones de base de datos?

### 7. Git Workflow
- ¿Antigravity hace auto-deploy desde main/master o desde otro branch?
- ¿Debo hacer merge del branch `claude/setup-nestjs-project-CXpSb` a main?
- ¿O Antigravity puede deployar desde feature branches?

### 8. Preferencias
- ¿Quieres que ambas apps compartan la misma DB y Redis? (recomendado para desarrollo)
- ¿O prefieres tener todo separado?
- ¿Qué puerto quieres para el comparador? (actualmente configurado en 3000)
- ¿Necesitas reverse proxy o nginx para rutear tráfico?

---

## Formato de Respuesta

Por favor responde en este formato para que sea fácil de parsear:

```
DOCKER_COMPOSE_LOCATION: /ruta/al/docker-compose.yml
SERVICIOS_ACTUALES: postgres, redis, dashboard
DASHBOARD_PORT: 3001
DASHBOARD_PATH: apps/dashboard

DB_COMPARTIDA: sí/no
REDIS_COMPARTIDO: sí/no
DB_NAME_ACTUAL: nombre_db
DB_USER: usuario
DB_PASSWORD: password
DB_PORT: 5432
REDIS_PORT: 6379

COMPARADOR_PORT_DESEADO: 3000
APPS_COMUNICACION: sí/no (y cómo)

ENV_LOCATION: raíz/.env o apps/*/  .env
ANTIGRAVITY_DEPLOY_METHOD: docker-compose/scripts/CI-CD
ANTIGRAVITY_CONFIG_FILES: listar archivos especiales

GIT_DEPLOY_BRANCH: main/master/otro
MONOREPO_TOOL: turborepo/nx/ninguno

OTRAS_NOTAS: cualquier cosa adicional importante
```

---

## Archivos que podrías necesitar ver:

Si necesitas ver alguno de estos archivos para responder mejor, pídemelos:
- `docker-compose.yml`
- `package.json` (raíz)
- `.env` o `.env.example`
- Estructura de directorios (`tree -L 2`)
- Configuración del dashboard
- Archivos de config de Antigravity

**¡Gracias! Con tus respuestas crearé la guía de deployment perfecta.**
