# Decisión de Arquitectura: Modelo de Embeddings

## Decisión
**Modelo elegido**: `models/text-embedding-004` de Google Gemini
**Dimensiones**: 768
**Columna DB**: `vector(768)` en `dossier_chunks.embedding`

## Razones
1. **GEMINI_API_KEY ya configurada** en el proyecto (apps/legitwatch-comparator/.env). No se requiere nueva API key.
2. **Sin dependencias adicionales**: El proyecto ya usa axios para llamadas HTTP directas a Gemini. No se necesita SDK adicional.
3. **Rendimiento adecuado**: 768 dims es suficiente para retrieval semántico legislativo en español.
4. **Consistencia**: El proyecto ya usa Gemini 2.0 Flash para generación de texto. Mantener un solo proveedor reduce complejidad.
5. **Costo**: text-embedding-004 es más económico que alternativas de OpenAI (text-embedding-3-large a 1536 dims).

## Alternativa descartada
- `text-embedding-3-large` de OpenAI (1536 dims): requiere OPENAI_API_KEY no presente en el proyecto.

## Nota sobre dimensiones en el spec
El spec del prompt menciona `vector(1536)` como compatible con text-embedding-004, pero esto es incorrecto.
text-embedding-004 produce vectores de **768 dimensiones** por defecto.
La migración CreateDossierModule usa correctamente `vector(768)`.
