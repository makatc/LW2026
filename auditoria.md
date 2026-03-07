# Auditoría Técnica y de Producto - LegitWatch / Sutra

## Introducción

Este documento representa la auditoría técnica y de producto sobre la base de código actual del monorepo. 

> **Aviso:** Para completar los puntos **5 al 10**, necesito que me compartas la **especificación original** y los detalles del **producto/app original de referencia**. A continuación, presento el análisis correspondiente a los puntos 1 al 4 basado en el código actual.

---

## 1. Análisis del Código Actual

El sistema está construido como un **monorepo** (gestionado por pnpm y turborepo) que divide la lógica en múltiples aplicaciones y paquetes compartidos. Esto indica un enfoque modular diseñado para escalar y separar responsabilidades.

## 2. Tecnologías Utilizadas

Basado en el análisis de los archivos de configuración (`package.json`) y la estructura del proyecto, las tecnologías reales implementadas son:

- **Lenguaje:** TypeScript (y JavaScript)
- **Frameworks Principales:** 
  - **Frontend:** Next.js 14 (React 18) para `sutra-dashboard`.
  - **Backend:** NestJS (versiones 10 y 11) para los microservicios `sutra-monitor` y `legitwatch-comparator`.
- **Librerías Principales:**
  - *Frontend:* Tailwind CSS (estilos), `@tanstack/react-query` (manejo de estado del servidor), `lucide-react` (iconos).
  - *Scraping:* `playwright` (en el monitor).
  - *Procesamiento de Documentos:* `pdf-parse`, `mammoth` (Word), y herramientas de diferencias como `diff2html` y `diff-match-patch` (en el comparador).
  - *Colas/Tareas en background:* `bullmq` e `ioredis`.
- **Base de Datos:** PostgreSQL. Hay acceso a datos mediante consultas directas (paquete `@lwbeta/db` con `pg`) y un ORM estructurado (`TypeORM` en `legitwatch-comparator`).
- **Autenticación:** Sistema basado en JWT (`@nestjs/jwt`, `passport-jwt`, `bcrypt`) localizado en `sutra-monitor`.
- **Arquitectura General:** Microservicios / Sistema Distribuido Modular dentro de un Monorepo.

## 3. Funcionamiento de la App (Flujo General)

### Frontend (`sutra-dashboard`)
Actúa como la interfaz de usuario. Consume las APIs distribuidas que proveen los otros módulos. Utiliza Next.js, lo que permite renderizado en el servidor (SSR) para vistas iniciales y una experiencia de SPA (Single Page Application) fluida para el resto de la navegación.

### Backend Integrado (`sutra-monitor` y `legitwatch-comparator`)
El backend está dividido lógicamente:
- **Sutra Monitor:** Se encarga de la recolección de datos activos. Utiliza **Playwright** para hacer scraping de sitios, ejecutándose de forma controlada mediante cron jobs (`@nestjs/schedule`) o colas. Contiene un flujo de validación de autenticación.
- **Legitwatch Comparator:** Funciona como el "motor" de análisis de documentos. Recibe archivos (PDFs/DOCX), extrae su texto crudo y genera diferencias visuales o semánticas sobre cómo han cambiado las leyes o documentos.

### Flujo de Datos
1. El usuario interactúa con Next.js y solicita subir un documento para comparar, o visualiza los datos scrapeados.
2. Los envíos de archivos complejos van a `legitwatch-comparator`.
3. Tareas asíncronas pesadas (como largos procesos de scraping o generación de diffs pesados) se encolan usando Redis (`bullmq`).
4. Ambos servicios guardan sus resultados en PostgreSQL.
5. Next.js lee estos resultados y los presenta al usuario (utilizando `react-query` para mantener la interfaz actualizada).

## 4. Método de Desarrollo y Enfoque

- **Microservicios (Service-Oriented):** Existe una clara separación entre la UI, el scraper/monitor y el comparador.
- **Scraping / Automatización:** Utiliza explícitamente `playwright` (probablemente de forma headless) para extraer información.
- **Colas / Procesamiento Asíncrono:** Emplea Redis (mediante `ioredis` y `BullMQ`) fundamental para no bloquear los procesos rápidos de la API cuando realiza scraping intensivo o comparaciones de textos muy grandes.
- **Comparación (Diffing):** Usa algoritmos de diferenciación de texto (`diff-match-patch`, `diff2html`), no parece usar LLMs nativos puramente para comparar texto, sino motores tradicionales matemáticos de diffs. (Aunque existe un paquete llamado `lw-llm` y `lw-embeddings`, su integración de los `package.json` principales requiere más análisis del código fuente, lo que indica que *podría* haber un enfoque RAG o IA latente o modularizado).

---

## 5. Comparación con la Especificación Original

La especificación original (PROMPT GENERAL 1) solicitaba una arquitectura **monolítica Full-Stack** basada enteramente en Next.js (App Router y Server Actions), fuertemente acoplada a herramientas visuales específicas (`@monaco-editor/react`) y una integración directa con OpenAI. 

La implementación actual en el código difiere significativamente en su arquitectura base, adoptando un enfoque mucho más complejo y escalable (**Microservicios en un Monorepo** usando NestJS, TypeORM y BullMQ).

## 6. Análisis de Implementación (Brechas y Desviaciones)

- **Qué sí se construyó correctamente:**
  - El uso de **Next.js 14+** y **Tailwind CSS** para el frontend.
  - El tipado estricto con **TypeScript**.
  - La integración de motores de diferencias (`diff-match-patch` está presente en el backend del comparador).
  - La capacidad de procesar archivos complejos (se incluyeron `pdf-parse` y `mammoth` para cubrir más allá del texto plano solicitado en el MVP).
- **Qué está parcialmente implementado:**
  - **Integración de IA:** La lógica de inteligencia artificial (OpenAI para evaluación de impacto) no parece estar acoplada de forma simple en una "Server Action" de Next.js como se pedía, sino delegada a paquetes internos (`lw-llm`) o colas del backend.
- **Qué falta:**
  - **Visor de Diferencias (Monaco Editor):** No hay rastro de `@monaco-editor/react` en las dependencias del frontend, lo cual era un requisito estricto para el visor de diffs.
  - Layout estricto 70/30 (difícil de garantizar sin los componentes de Monaco).
- **Qué se desvió de la idea original (Desviación Arquitectónica):**
  - Se solicitó un frontend con lógica de servidor integrada (`app/api` o *Server Actions*). En su lugar, el equipo de desarrollo construyó un ecosistema de backend separado en **NestJS** (`sutra-monitor` y `legitwatch-comparator`), añadiendo bases de datos complejas (PostgreSQL) y sistemas de colas (Redis/BullMQ). Es una arquitectura superior para producción a gran escala, pero es una desviación directa del requerimiento original de simplicidad (Full-Stack Next.js).

## 7. Tabla Comparativa de Requisitos

| Requisito Original | Implementación Actual | Estado | Evidencia en el Código | Recomendación |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js 14+ (App Router)** | Aplicado en `sutra-dashboard` | ✅ Completo | `apps/sutra-dashboard/package.json` | Mantener. |
| **TypeScript Estricto & Tailwind** | Aplicado globalmente | ✅ Completo | Configuración de TsConfig y PostCSS/Tailwind en monorepo. | Mantener. |
| **Monolito API (Server Actions)** | Microservicios en NestJS separados | ⚠️ Desviado | `apps/legitwatch-comparator` y `apps/sutra-monitor` separan la lógica. | Aceptar desviación; la arquitectura actual es más robusta y escalable que la solicitada. |
| **Visor: `@monaco-editor/react`** | Ausente en frontend | ❌ Faltante | No existe en `package.json` del frontend. Se usa `diff2html` en backend. | Instalar Monaco Editor en Next.js e integrarlo a la UI para el visor 70/30. |
| **Motor: `diff-match-patch`** | Implementado en el backend | ✅ Completo | `diff-match-patch` en `apps/legitwatch-comparator`. | Validar que se esté llamando a `diff_cleanupSemantic(diffs)`. |
| **Análisis IA con JSON Estricto** | Paquetes separados (`lw-llm`) | 🟡 Parcial | Paquetes de infraestructura existen, pero el flujo simple Next->OpenAI no está. | Verificar que el backend retorne exactamente el esquema JSON (`executive_summary`, etc.) al frontend. |
| **UI: Split Screen (70/30)** | Interfaz genérica (sin Monaco) | 🟡 Parcial | Faltan herramientas clave en frontend para lograrlo al pie de la letra. | Refactorizar el componente principal de UI tras añadir Monaco. |

## 8 y 9. Comparación con Producto de Referencia

*(Estos pasos han sido omitidos ya que el usuario indicó que no existe un producto o app de referencia previa)*.

## 10. Resumen Ejecutivo

### ¿Qué hace realmente esta app?
Actualmente, el proyecto es una **Plataforma Distribuida de Inteligencia y Monitoreo Legal**. No es solo un simple "comparador" web; el proyecto ha evolucionado hacia un sistema pesado capaz de realizar *web scraping* automatizado y programado (Sutra Monitor), colas de procesamiento de documentos largos (Redis), y un motor de diferenciación backend independiente.

### ¿Cumple el objetivo original?
**Sí y No.**
- **Sí,** a nivel de capacidades, el sistema tiene mucha más potencia de la solicitada en el MVP (soporte a PDFs, DOCX, colas de trabajo, automatización de scraping en background).
- **No,** a nivel de fidelidad técnica con el Prompt 1. Se ignoró la instrucción estricta de usar un flujo monolítico simple con "Server Actions" y `@monaco-editor/react` para mantener toda la interfaz y lógica ágil en el ecosistema Next.js puro. 

### ¿Qué le falta para igualarse a la especificación original?
1. **La Interfaz de Monaco Editor:** El comparador visual propuesto (pantalla dividida 70/30 con código/texto lado a lado) no es posible sin integrar la dependencia de Monaco en el frontend.
2. **Alineación del flujo de respuesta de la IA:** Se debe garantizar que el microservicio de comparación devuelva exactamente los parámetros `executive_summary`, `stakeholders_affected` y `long_term_forecast` al frontend para llenar el "Panel de Inteligencia".

### Prioridades de Mejora
1. **Producto (Frontend):** Instalar `@monaco-editor/react` en `sutra-dashboard` y refactorizar la vista de resultados para cumplir estrictamente con el layout 70/30 visual.
2. **Back-end Orchestration:** Auditar el endpoint exacto del comparador en NestJS (`legitwatch-comparator`) para confirmar que envía el prompt estricto a OpenAI y asegurar el formato `json_object` de salida para que el frontend lo pueda pintar en los *badges/cards*.
3. **Deuda Técnica por sobreingeniería:** Aceptar la arquitectura orientada a microservicios ya construida, ya que deshacerla por un monolito Next.js implicaría rehacer el proyecto 100%. Concentrarse en conectar correctamente la interfaz Next.js con los servicios NestJS.