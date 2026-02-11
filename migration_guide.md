# Guía de Migración de Base de Datos: Windows a Linux Mint

Esta guía detalla cómo mover tu base de datos PostgreSQL (`sutra_monitor`) que corre en Docker Desktop (Windows) a tu nuevo entorno en Linux Mint.

## Prerrequisitos

- Acceso a tu terminal en Windows (PowerShell o CMD).
- Docker Desktop corriendo en Windows.
- Un medio para transferir el archivo (USB, Google Drive, o red local).

---

## Paso 1: Crear el Respaldo (En Windows)

La forma más segura y compatible de migrar entre sistemas operativos es usar `pg_dumpall`. Esto crea un archivo SQL plano que puede ser restaurado en cualquier sistema, independientemente de la versión exacta de Linux o arquitectura del procesador.

1.  Abre tu terminal (PowerShell) en la carpeta de tu proyecto `LWBETA`.
2.  Asegúrate de que tu contenedor de base de datos esté corriendo:
    ```powershell
    docker-compose up -d postgres
    ```
3.  Ejecuta el siguiente comando para generar el dump completo (incluyendo usuarios y roles):
    ```powershell
    # Esto creará un archivo 'backup_completo.sql' en tu carpeta actual
    docker compose exec -T postgres pg_dumpall -c -U postgres > backup_completo.sql
    ```
    *Nota: Si tu contenedor se llama diferente a `postgres` en el servicio, ajusta el nombre. `-c` incluye comandos para limpiar (DROP) bases de datos existentes antes de crear las nuevas, lo cual es útil para una restauración limpia.*

4.  Verifica que el archivo se creó y tiene contenido:
    ```powershell
    ls -lh backup_completo.sql
    ```

## Paso 2: Transferir el Archivo

Copia el archivo `backup_completo.sql` a tu medio de almacenamiento externo o súbelo a la nube. También copia tu carpeta completa del proyecto `LWBETA` (código fuente), pero **puedes excluir** la carpeta `node_modules` y `.next` para hacerlo más ligero.

---

## Paso 3: Restaurar en Linux Mint

Una vez que tengas Linux Mint instalado y tu código copiado ahí:

1.  **Instala Docker y Docker Compose** en Linux Mint si aún no lo has hecho.
2.  Abre la terminal en la carpeta de tu proyecto en Linux.
3.  Inicia el servicio de base de datos (iniciará vacío):
    ```bash
    docker compose up -d postgres
    ```
4.  Espera unos segundos a que la base de datos arranque completamente.
5.  Copia tu archivo de respaldo a la carpeta del proyecto en Linux (si no está ahí ya).
6.  Restaura el respaldo usando este comando:
    ```bash
    cat backup_completo.sql | docker compose exec -T postgres psql -U postgres
    ```

## Paso 4: Verificación

Para confirmar que todo está correcto:

1.  Conéctate a la base de datos:
    ```bash
    docker compose exec postgres psql -U postgres -d sutra_monitor
    ```
2.  Lista las tablas para ver si tus datos están ahí:
    ```sql
    \dt
    ```
3.  (Opcional) Haz un query simple:
    ```sql
    SELECT count(*) FROM users; -- O alguna tabla que sepas que tiene datos
    ```

## Troubleshooting

- **Error de versión**: Si recibes errores sobre versiones de SCRAM-SHA-256 o autenticación, asegúrate de que estás usando la misma versión de imagen de Docker (`postgres:16-alpine`) en ambos lados. Al usar Docker, esto suele ser automático si usas el mismo `docker-compose.yml`.
- **Permisos de archivo**: En Linux, asegúrate de que el archivo `backup_completo.sql` tenga permisos de lectura si tienes problemas (`chmod 644 backup_completo.sql`).
