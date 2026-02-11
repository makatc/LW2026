# 🧪 Guía de Pruebas - LegalWatch Comparador

Cómo probar todas las funcionalidades implementadas hasta ahora.

## 🚀 Prerequisitos

### 1. Levantar el Backend

```bash
cd /home/user/LWBETA/apps/legitwatch-comparator
npm run start:dev
```

El comparador estará corriendo en: `http://localhost:3002`

### 2. Verificar que Docker esté corriendo

```bash
docker compose ps
```

Debe mostrar:
- ✅ PostgreSQL (puerto 5433)
- ✅ Redis (puerto 6379)

---

## 📋 Tests por Funcionalidad

### ✅ TEST 1: Health Check

```bash
curl http://localhost:3002

# Respuesta esperada:
# {"message":"Hello from LegalWatch Comparador!"}
```

---

### ✅ TEST 2: Upload de Archivo TXT

#### Preparar archivo de prueba:

```bash
# Crear un archivo de prueba
cat > /tmp/ley-test.txt << 'EOF'
LEY ORGÁNICA 15/1999, DE PROTECCIÓN DE DATOS

CAPÍTULO I
Disposiciones Generales

ARTÍCULO 1. Objeto de la Ley
La presente ley tiene por objeto garantizar y proteger las libertades públicas.

ARTÍCULO 2. Ámbito de Aplicación
Esta ley será de aplicación a los datos de carácter personal.

CAPÍTULO II
Principios de la Protección de Datos

ARTÍCULO 3. Principio de Calidad
Los datos deberán ser exactos y actualizados.

ARTÍCULO 4. Principio de Información
El titular deberá ser informado previamente.
EOF
```

#### Upload:

```bash
curl -X POST http://localhost:3002/documents/upload \
  -F "file=@/tmp/ley-test.txt" \
  -F "title=Ley de Protección de Datos - Versión Original" \
  -F "description=Primera versión de la ley"

# Respuesta esperada:
{
  "success": true,
  "documentId": "uuid-generado-1",
  "versionId": "uuid-version-1",
  "snapshotId": "uuid-snapshot-1",
  "message": "File uploaded successfully: ley-test.txt",
  "metadata": {
    "fileName": "ley-test.txt",
    "fileSize": 456,
    "wordCount": 67,
    "pageCount": undefined
  }
}
```

**💾 Guarda estos IDs para los siguientes tests!**

---

### ✅ TEST 3: Upload de Segundo Archivo (Versión Modificada)

```bash
# Crear versión modificada
cat > /tmp/ley-test-v2.txt << 'EOF'
LEY ORGÁNICA 15/1999, DE PROTECCIÓN DE DATOS

CAPÍTULO I
Disposiciones Generales

ARTÍCULO 1. Objeto de la Ley
La presente ley tiene por objeto garantizar y proteger las libertades públicas y privadas.

ARTÍCULO 2. Ámbito de Aplicación
Esta ley será de aplicación a los datos de carácter personal registrados en soporte electrónico.

CAPÍTULO II
Principios de la Protección de Datos

ARTÍCULO 3. Principio de Calidad
Los datos podrán ser exactos y actualizados de forma periódica.

ARTÍCULO 4. Principio de Información
El titular podrá ser informado previamente mediante notificación escrita.

ARTÍCULO 5. Derecho de Acceso
Todo ciudadano tiene derecho a acceder a sus datos personales.
EOF

curl -X POST http://localhost:3002/documents/upload \
  -F "file=@/tmp/ley-test-v2.txt" \
  -F "title=Ley de Protección de Datos - Versión Modificada"

# Guarda el documentId y versionId
```

---

### ✅ TEST 4: Verificar Job de Ingestion

Cuando subes un archivo con `autoIngest=true` (default), se crea un job de BullMQ.

```bash
# Listar jobs en la queue
curl http://localhost:3002/documents/queue/stats

# Respuesta:
{
  "waiting": 0,
  "active": 0,
  "completed": 2,
  "failed": 0,
  "delayed": 0
}
```

Si ves `completed > 0`, significa que el job procesó exitosamente! 🎉

---

### ✅ TEST 5: Verificar que se Crearon Chunks

```bash
# Conectarse a la base de datos
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator

# Dentro de psql:
SELECT COUNT(*) FROM document_chunks;
SELECT chunk_type, chunk_index, LEFT(content, 50) FROM document_chunks ORDER BY chunk_index LIMIT 10;

# Deberías ver chunks con tipos:
# - CHAPTER (Capítulos)
# - ARTICLE (Artículos)
```

Salir con `\q`

---

### ✅ TEST 6: Comparar las Dos Versiones

```bash
# Reemplaza con tus versionIds reales del TEST 2 y 3
export VERSION_1="uuid-version-1"
export VERSION_2="uuid-version-2"

curl -X POST http://localhost:3002/comparison/compare \
  -H "Content-Type: application/json" \
  -d "{
    \"sourceVersionId\": \"$VERSION_1\",
    \"targetVersionId\": \"$VERSION_2\"
  }"

# Respuesta:
{
  "jobId": "123",
  "status": "added",
  "message": "Comparison job queued"
}
```

**💾 Guarda el jobId!**

---

### ✅ TEST 7: Check Comparison Job Status

```bash
export JOB_ID="123"

curl http://localhost:3002/comparison/jobs/$JOB_ID

# Mientras procesa:
{
  "id": "123",
  "state": "active",
  "progress": 50
}

# Cuando termina:
{
  "id": "123",
  "state": "completed",
  "progress": 100,
  "returnvalue": {
    "comparisonId": "uuid-comparison-1"
  }
}
```

**💾 Guarda el comparisonId!**

---

### ✅ TEST 8: Ver Resultado de la Comparación

```bash
export COMPARISON_ID="uuid-comparison-1"

curl http://localhost:3002/projects/$COMPARISON_ID/summary

# Respuesta (simplificada):
{
  "comparisonId": "uuid-comparison-1",
  "status": "COMPLETED",
  "sourceDocument": {
    "id": "...",
    "title": "Ley de Protección de Datos - Versión Original",
    "versionId": "...",
    "versionTag": "v1-..."
  },
  "targetDocument": {
    "id": "...",
    "title": "Ley de Protección de Datos - Versión Modificada",
    "versionId": "...",
    "versionTag": "v1-..."
  },
  "summary": "Major changes detected: obligation shifts, scope expansion...",
  "impactScore": 75,
  "totalChanges": 4,
  "chunkComparisons": [
    {
      "sourceChunkId": "...",
      "targetChunkId": "...",
      "diffHtml": "<span>Los datos </span><del>deberán</del><ins>podrán</ins><span> ser exactos...</span>",
      "changeType": "obligation_shift",
      "impactScore": 0.9
    },
    ...
  ]
}
```

🎉 **¡Puedes ver los diffs HTML y los cambios semánticos detectados!**

---

### ✅ TEST 9: Export PDF (Mock)

```bash
curl http://localhost:3002/projects/$COMPARISON_ID/export

# Respuesta:
{
  "message": "PDF Generation Pending",
  "comparisonId": "uuid-comparison-1",
  "status": "queued"
}
```

---

### ✅ TEST 10: Upload de PDF (Si tienes un PDF)

```bash
# Si tienes un PDF de una ley:
curl -X POST http://localhost:3002/documents/upload \
  -F "file=@/ruta/a/tu/ley.pdf" \
  -F "title=Ley desde PDF"

# El sistema:
# 1. Extrae el texto del PDF
# 2. Lo normaliza (limpia headers/footers)
# 3. Detecta la estructura (artículos, capítulos)
# 4. Crea chunks
```

---

### ✅ TEST 11: Upload de Word (Si tienes un .docx)

```bash
curl -X POST http://localhost:3002/documents/upload \
  -F "file=@/ruta/a/tu/ley.docx" \
  -F "title=Ley desde Word"
```

---

### ✅ TEST 12: Batch Upload

```bash
# Crear múltiples archivos
cat > /tmp/ley1.txt << 'EOF'
ARTÍCULO 1. Primera ley de prueba.
EOF

cat > /tmp/ley2.txt << 'EOF'
ARTÍCULO 1. Segunda ley de prueba.
EOF

# Upload en batch
curl -X POST http://localhost:3002/documents/upload/batch \
  -F "files=@/tmp/ley1.txt" \
  -F "files=@/tmp/ley2.txt"

# Respuesta: array con 2 resultados
[
  { "success": true, "documentId": "...", ... },
  { "success": true, "documentId": "...", ... }
]
```

---

## 🔍 Verificación en Base de Datos

### Ver todos los documentos:

```sql
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "
  SELECT id, title, document_type, created_at
  FROM documents
  ORDER BY created_at DESC
  LIMIT 5;
"
```

### Ver snapshots:

```sql
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "
  SELECT id, source_type, original_file_name, file_size, created_at
  FROM source_snapshots
  ORDER BY created_at DESC
  LIMIT 5;
"
```

### Ver versiones:

```sql
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "
  SELECT id, document_id, version_tag, status, created_at
  FROM document_versions
  ORDER BY created_at DESC
  LIMIT 5;
"
```

### Ver chunks:

```sql
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "
  SELECT chunk_type, chunk_index, LEFT(content, 80) as content_preview
  FROM document_chunks
  ORDER BY chunk_index
  LIMIT 10;
"
```

### Ver comparaciones:

```sql
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "
  SELECT id, status, impact_score, created_at
  FROM comparison_results
  ORDER BY created_at DESC
  LIMIT 5;
"
```

---

## 🐛 Troubleshooting

### Error: Cannot connect to database

```bash
# Verificar PostgreSQL
docker compose ps postgres
docker compose logs postgres

# Reiniciar si es necesario
docker compose restart postgres
```

### Error: Redis connection refused

```bash
# Verificar Redis
docker compose ps redis
docker compose logs redis

# Reiniciar
docker compose restart redis
```

### Error: Jobs not processing

```bash
# Ver logs del comparador
# En la terminal donde corre npm run start:dev

# Verificar queue
curl http://localhost:3002/documents/queue/stats

# Si hay jobs failed:
# Revisar logs para ver el error
```

### Error: File upload fails

```bash
# Verificar que el archivo existe
ls -lh /tmp/ley-test.txt

# Verificar tamaño (max 10MB)
du -h /tmp/ley-test.txt

# Verificar mime type
file --mime-type /tmp/ley-test.txt
```

---

## 📊 Métricas de Éxito

Si todos los tests pasan, deberías tener:

- ✅ **2+ documentos** en la base de datos
- ✅ **2+ versiones** creadas
- ✅ **10+ chunks** detectados (artículos, capítulos)
- ✅ **1+ comparación** completada
- ✅ **Diffs HTML** generados
- ✅ **Cambios semánticos** detectados (obligation shifts, etc.)

---

## 🎯 Próximos Pasos

Una vez que todos los tests pasen:

1. **Probar con documentos reales** (PDFs de leyes de Puerto Rico)
2. **Ver los diffs HTML** en el browser (copiar el HTML y abrirlo)
3. **Analizar los cambios semánticos** detectados
4. **Proceder con FASE 3** (Frontend UI)

---

## 💡 Tips

### Ver el diff HTML en el browser:

```bash
# Get comparison result
curl http://localhost:3002/projects/$COMPARISON_ID/summary > result.json

# Extraer el diff HTML de un chunk
cat result.json | jq -r '.chunkComparisons[0].diffHtml' > diff.html

# Abrir en browser
open diff.html  # Mac
xdg-open diff.html  # Linux
```

### Monitorear jobs en tiempo real:

```bash
# En una terminal separada
watch -n 2 'curl -s http://localhost:3002/documents/queue/stats | jq'
```

### Limpiar la base de datos para empezar de nuevo:

```bash
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "
  TRUNCATE TABLE comparison_results, document_chunks, document_versions, documents, source_snapshots RESTART IDENTITY CASCADE;
"
```

---

## ✅ Checklist de Pruebas

- [ ] Health check funciona
- [ ] Upload TXT funciona
- [ ] Upload genera snapshot
- [ ] Jobs de ingestion se procesan
- [ ] Chunks se crean correctamente
- [ ] Upload PDF funciona (si tienes PDF)
- [ ] Upload Word funciona (si tienes .docx)
- [ ] Batch upload funciona
- [ ] Comparación se crea
- [ ] Job de comparación se procesa
- [ ] Resultado tiene diffs HTML
- [ ] Cambios semánticos se detectan
- [ ] Export PDF devuelve "pending"

---

**🎉 Si todos los checks pasan, ¡el backend está 100% funcional!**

Siguiente: FASE 3 - Crear el Frontend bonito para usar todo esto. 🚀
