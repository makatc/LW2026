# Guía de Instalación - SUTRA Monitor

Para correr este proyecto necesitas instalar algunas herramientas básicas. He detectado que tienes **winget** instalado, así que será muy fácil.

## 1. Instalar Node.js (Entorno de ejecución)

Abre un **PowerShell como Administrador** y corre el siguiente comando:

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

*Una vez termine, cierra TÚ terminal actual y abre una nueva para que reconozca los cambios.*

Para verificar que se instaló bien, corre:
```powershell
node --version
npm --version
```

## 2. Instalar pnpm (Gestor de paquetes)

Este proyecto usa `pnpm` en lugar de `npm` porque es más rápido y eficiente para monorepos.
En tu nueva terminal corre:

```powershell
npm install -g pnpm
```

Verifica con:
```powershell
pnpm --version
```

## 3. Instalar Docker Desktop (Base de Datos)

El proyecto usa PostgreSQL y Redis. La forma más fácil de correrlos sin configurar todo manualmente es usar Docker.

```powershell
winget install -e --id Docker.DockerDesktop
```

*Nota: Docker Desktop requiere reiniciar la PC después de instalar.*

---

## 4. Iniciar el Proyecto (Una vez instalado todo)

1. **Instalar dependencias del proyecto:**
   ```powershell
   # En la carpeta raíz del proyecto (LWBETA)
   pnpm install
   ```

2. **Levantar la base de datos:**
   Abre Docker Desktop, espera que inicie, y luego en la terminal del proyecto:
   ```powershell
   docker-compose up -d
   ```

3. **Correr el proyecto en modo desarrollo:**
   ```powershell
   pnpm dev
   ```

Esto iniciará tanto el backend (sutra-monitor) como el frontend (sutra-dashboard).
