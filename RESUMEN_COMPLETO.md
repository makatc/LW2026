# ✅ Resumen de Progreso - Sistema SUTRA Monitor

## Completado Hoy (2026-02-08)

### 1. ✅ Migración SMTP (Backend + Frontend)
- **Backend**: `NotificationService` actualizado para usar config SMTP por usuario
- **Base de Datos**: 
  - Agregadas columnas SMTP a `monitor_configs`
  - Schema de notificaciones (`notification_status`, `notification_sent_at`) aplicado
-  **Frontend**: UI de configuración SMTP en `/config`
- **Limpieza**: Eliminado `AdminSettingsController` obsoleto

### 2. ✅ Scraper Actualizado
- **Problema**: URL antigua `MedidaReg.aspx` no funcionaba (redirige)
- **Solución**: Actualizado a `https://sutra.oslpr.org/medidas`
- **Nuevo método**: Extrae del texto usando patrón `Medida: XX0000`
- **Verificado**: Build exitoso, test manual confirmó extracción

### 3. ✅ Infraestructura
- **Docker**: Base de datos PostgreSQL corriendo  
- **Backend**: Compilado sin errores
- **Frontend**: Build exitoso

---

## Pendiente (Para Completar)

### 🎯 Tarea Principal: Validación Manual de Alertas

**Objetivo**: Verificar que el sistema envía emails cuando detecta nuevas medidas.

#### Pasos para Validar:

**1. Revisar Configuración Actual**

Ejecuta en la terminal SQL (psql o tu cliente preferido):

```sql
-- Ver usuarios
SELECT id, email, role FROM users;

-- Ver sus configuraciones
SELECT 
    u.email,
    mc.id as config_id,
    mc.smtp_host,
    mc.smtp_port,
    mc.smtp_from
FROM monitor_configs mc
JOIN users u ON u.id = mc.user_id;

-- Ver keywords configuradas
SELECT 
    u.email,
    kr.keyword,
    kr.enabled
FROM keyword_rules kr
JOIN monitor_configs mc ON mc.id = kr.config_id
JOIN users u ON u.id = mc.user_id
WHERE kr.enabled = true;

-- Ver hits pendientes
SELECT 
    u.email,
    sm.numero,
    sm.titulo,
    dh.matched_keywords,
    dh.notification_status,
    dh.created_at
FROM discovery_hits dh
JOIN monitor_configs mc ON mc.id = dh.config_id
JOIN users u ON u.id = mc.user_id
JOIN sutra_measures sm ON sm.id = dh.measure_id
WHERE dh.notification_status = 'PENDING'
ORDER BY dh.created_at DESC;
```

**2. Configurar SMTP (Si no está configurado)**

1. Inicia el dashboard: `pnpm --filter=sutra-dashboard dev`
2. Accede a `http://localhost:3000/login`
3. Ve a `/config`
4. Completa la sección "Configuración de Email (SMTP)":
   - Para Gmail:
     - Host: `smtp.gmail.com`
     - Port: `587`
     - User: tu-email@gmail.com
     - Password: [Contraseña de aplicación](https://myaccount.google.com/apppasswords)
     - From: tu-email@gmail.com
5. Guarda

**3. Crear Datos de Prueba (Opción Manual)**

Si no hay hits PENDING, créalos manualmente en SQL:

```sql
-- 1. Insertar medida de prueba
INSERT INTO sutra_measures (numero, titulo, url, fecha_radicacion, created_at, updated_at)
VALUES ('TEST9999', 'Proyecto prueba sobre salud pública', 
        'https://sutra.oslpr.org/medidas/TEST9999', 
        CURRENT_DATE, NOW(), NOW())
ON CONFLICT (numero) DO UPDATE SET updated_at = NOW()
RETURNING id;

-- 2. Agregar keyword (si no tienes)
-- Reemplaza <config_id> con tu ID de configuración
INSERT INTO keyword_rules (config_id, keyword, enabled, created_at)
VALUES ('<config_id>', 'salud', true, NOW())
ON CONFLICT DO NOTHING;

-- 3. Crear discovery hit PENDING
-- Reemplaza <config_id> y <measure_id>
INSERT INTO discovery_hits (config_id, measure_id, matched_keywords, matched_phrases, notification_status, created_at)
VALUES ('<config_id>', '<measure_id>', ARRAY['salud'], ARRAY[]::text[], 'PENDING', NOW())
ON CONFLICT (config_id, measure_id) 
DO UPDATE SET notification_status = 'PENDING', created_at = NOW();
```

**4. Activar Procesamiento de Notificaciones**

Opción A - Esperar al cron (5 minutos):
```bash
# El NotificationService se ejecuta automáticamente cada 5 minutos
# Solo espera y revisa tu email
```

Opción B - Trigger manual (si existe endpoint):
```bash
curl -X POST http://localhost:3001/notifications/process
```

Opción C - Revisar logs del backend:
```bash
cd apps/sutra-monitor
pnpm start:dev

# Buscar en consola:
# [NotificationService] Found X batches...
# [NotificationService] Sending to user@example.com...
```

**5. Verificar Email Recibido**

- Revisa tu bandeja de entrada
- Busca email con subject que contenga el número de medida
- Verifica que incluya:
  - Número de medida
  - Título
  - Link a SUTRA
  - Keywords detectadas

---

## Notas Técnicas

### Tablas Principales
- `users`: Usuarios del sistema
- `monitor_configs`: Configuración por usuario (incluye SMTP)
- `keyword_rules`: Palabras clave a vigilar
- `sutra_measures`: Medidas legislativas
- `discovery_hits`: Matches encontrados (con `notification_status`)

### Estados de Notificación
- `PENDING`: Listo para enviar
- `SENT`: Ya enviado
- `FAILED`: Falló el envío

### Troubleshooting

**"No se envían emails"**
→ Verifica SMTP configurado en `/config`
→ Verifica hits PENDING en la tabla
→ Revisa logs del backend

**"Authentication failed (Gmail)"**
→ Usa contraseña de aplicación, no tu contraseña normal
→ Genera en: https://myaccount.google.com/apppasswords

**"Error: relation does not exist"**
→ Verifica nombres de tablas con:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

---

**Última actualización**: 2026-02-08 11:20
**Estado**: Listo para validación manual
