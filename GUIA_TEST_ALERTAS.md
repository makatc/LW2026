# 🧪 Sistema de Alertas - Guía de Prueba Manual

## Estado Actual
✅ **Backend**: NotificationService actualizado para SMTP por usuario
✅ **Base de Datos**: Schema de notificaciones (`notification_status`, `notification_sent_at`)  
✅ **Frontend**: UI de configuración SMTP en `/config`
✅ **Scraper**: Actualizado para nueva versión de SUTRA

## Próximos Pasos para Validar Alertas

### 1. Preparar Datos de Prueba

```bash
# Ejecutar desde la raíz del proyecto
node scripts/simple-test-setup.js
```

### 2. Configurar SMTP

1. Inicia el dashboard: `cd apps/sutra-dashboard && pnpm dev`
2. Ve a `http://localhost:3000/login`
3. Accede con tus credenciales
4. Ve a `/config`
5. En la sección "Configuración de Email (SMTP)", ingresa:
   - **Host**: smtp.gmail.com (o tu servidor)
   - **Port**: 587
   - **User**: tu-email@gmail.com
   - **Password**: tu-contraseña-de-app
   - **From**: tu-email@gmail.com
6. Guarda

### 3. Verificar Notificaciones Pendientes

```sql
-- Conectar a la DB y ejecutar:
SELECT 
    u.email,
    m.numero,
    m.titulo,
    dh.notification_status,
    dh.created_at
FROM discovery_hits dh
JOIN monitor_configs mc ON mc.id = dh.config_id
JOIN users u ON u.id = mc.user_id
JOIN measures m ON m.id = dh.measure_id
WHERE dh.notification_status = 'PENDING'
ORDER BY dh.created_at DESC;
```

### 4. Activar Envío Manual (Opcional)

Si no quieres esperar al cron job:

```bash
# Trigger manual del servicio de notificaciones
curl -X POST http://localhost:3001/notifications/process
```

O espera 5 minutos (el cron job corre cada 5 min).

### 5. Verificar Logs

```bash
# Ver logs del backend
cd apps/sutra-monitor
pnpm start:dev

# Buscar en consola:
# ✅ Found X batches...
# 📧 Sending to user@example.com...
# ✅ Notifications sent successfully
```

### 6. Verificar en Gmail

- Revisa tu bandeja de entrada
- Busca email con subject "🚨 Nueva Medida: ..."
- Verifica que contenga los detalles de la medida

## Troubleshooting

### Error: "SMTP not configured"
→ Asegúrate de haber guardado la config SMTP en `/config`

### Error: "Authentication failed"
→ Para Gmail, usa contraseña de aplicación (no tu contraseña normal)
→ Actívala en: https://myaccount.google.com/apppasswords

### No se envían emails
→ Verifica que haya hits PENDING en la DB
→ Revisa logs del backend
→ Confirma que el cron job esté activo

## Comandos Útiles

```bash
# Ver usuarios
node scripts/check-users.ts

# Ver configuración SMTP actual
psql -d sutra_monitor -c "SELECT user_id, smtp_host, smtp_port, smtp_from FROM monitor_configs;"

# Ver hits pendientes (count)
psql -d sutra_monitor -c "SELECT COUNT(*) FROM discovery_hits WHERE notification_status = 'PENDING';"

# Reset hits para re-probar
psql -d sutra_monitor -c "UPDATE discovery_hits SET notification_status = 'PENDING' WHERE id = 'xxx';"
```

---

**Última actualización**: 2026-02-08
