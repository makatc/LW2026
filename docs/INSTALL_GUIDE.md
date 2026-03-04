# Guía de Instalación - SUTRA Monitor + Legitwatch Comparador

Instrucciones para instalar y ejecutar el sistema completo en **Linux Debian/Ubuntu** o **macOS**.

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

### Verificar instalación:
```bash
node --version   # Debe ser v20.0.0 o superior
npm --version    # Debe ser 10+
```

---

## 2️⃣ Instalar PostgreSQL (12+)

### En Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

### En macOS (con Homebrew):
```bash
brew install postgresql
```

### Iniciar servicio:
```bash
# Debian/Ubuntu
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS
brew services start postgresql
```

### Crear usuario y base de datos:
```bash
sudo -u postgres psql << EOF
CREATE ROLE postgres WITH LOGIN PASSWORD 'password' SUPERUSER CREATEDB;
CREATE DATABASE sutra_monitor OWNER postgres;
CREATE DATABASE legitwatch_comparator OWNER postgres;

-- Extensiones necesarias
\c sutra_monitor;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

\c legitwatch_comparator;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
EOF
```

### Verificar conexión:
```bash
psql -h localhost -U postgres -c "SELECT 1;"
```

---

## 3️⃣ Instalar Redis (6+)

### En Debian/Ubuntu:
```bash
sudo apt-get install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### En macOS (con Homebrew):
```bash
brew install redis
brew services start redis
```

### Verificar conexión:
```bash
redis-cli ping   # Debe responder "PONG"
```

---

## 4️⃣ Clonar Repositorio e Instalar Dependencias

```bash
cd ~
git clone <REPO_URL> LWBETA
cd LWBETA

# Usar pnpm (package manager oficial del proyecto)
npm install -g pnpm@10

# Instalar dependencias
pnpm install
```

Verifica que no haya errores de compilación.

---

## 5️⃣ Configurar Variables de Entorno

### Monitor Backend (`apps/sutra-monitor/.env`)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/sutra_monitor
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
``` 

### Comparador Backend (`apps/legitwatch-comparator/.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=legitwatch_comparator
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3002
NODE_ENV=development
```

### Dashboard Frontend (`apps/sutra-dashboard/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COMPARATOR_API=http://localhost:3002
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

---

## 6️⃣ Ejecutar Migraciones de Base de Datos

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/sutra_monitor

cd packages/db
pnpm exec typeorm migration:run
```

Si todo va bien, verás: **"Migrations were executed successfully"`**

---

## 7️⃣ Iniciar Servicios

### Opción A: Todo automático (recomendado)
```bash
bash ~/LWBETA/dev.sh
```

Esto inicia los 3 servicios simultáneamente:
- ✅ Dashboard en `http://localhost:3000`
- ✅ Monitor API en `http://localhost:3001`
- ✅ Comparador en `http://localhost:3002` (con auto-restart)

**Presiona Ctrl+C** para detener todo.

### Opción B: Servicios individuales
```bash
# Terminal 1 - Dashboard
cd ~/LWBETA/apps/sutra-dashboard
npm run dev

# Terminal 2 - Monitor
cd ~/LWBETA/apps/sutra-monitor
npm run start:dev

# Terminal 3 - Comparador
cd ~/LWBETA/apps/legitwatch-comparador
npm run start:dev
```

---

## 8️⃣ Acceder a la Aplicación

1. Abre `http://localhost:3000` en tu navegador
2. **Usuarios por defecto:**
   - Email: `admin@legalwatch.pr`
   - Password: `password`
3. Verifica que puedas:
   - Ver el dashboard con estadísticas
   - Acceder a la sección "Comparador"
   - Subir un PDF de prueba

---

## ✅ Checklist de Verificación

- [ ] PostgreSQL corre en puerto 5432
- [ ] Redis corre en puerto 6379  
- [ ] `pnpm install` completó sin errores
- [ ] Migraciones BD ejecutadas (`typeorm migration:run`)
- [ ] Variables de entorno configuradas en los 3 servicios
- [ ] `bash ~/LWBETA/dev.sh` inicia 3 servicios sin fallos
- [ ] Dashboard accesible en `http://localhost:3000`
- [ ] Login funciona con las credenciales por defecto
- [ ] Test de upload de PDF funciona sin errores

---

## 🚨 Troubleshooting

### "connection refused" a PostgreSQL
```bash
# Verifica que esté corriendo:
sudo systemctl status postgresql

# O en macOS:
brew services list | grep postgres
```

### "connection refused" a Redis
```bash
# Verifica que esté corriendo:
sudo systemctl status redis-server

# O en macOS:
brew services list | grep redis
```

### Puertos ya en uso
```bash
# Mata procesos Node:
killall node

# O en puertos específicos:
kill $(lsof -t -i:3000,3001,3002)
```

### Error de migraciones
```bash
# Verifica que DATABASE_URL esté exportada:
echo $DATABASE_URL

# Reintenta:
cd packages/db
pnpm exec typeorm migration:run -c default
```

---

## 📚 Siguientes Pasos

1. **Lee el README.md** para entender la arquitectura
2. **Configura palabras clave** en http://localhost:3000/config
3. **Agrega medidas a monitorear** desde el dashboard
4. **Prueba el comparador** subiendo documentos

---

**Última actualización: Marzo 2026**
