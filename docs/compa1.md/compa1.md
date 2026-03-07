
PROMPT GENERAL 1: Desarrollo en TypeScript (Next.js Full-Stack) - RECOMENDADO
Contexto de Ejecución
Actúa como un Ingeniero de Software Principal y Arquitecto Full-Stack especializado en React, Next.js (App Router), TypeScript estricto y Tailwind CSS. Tu tarea es generar el código base completo para un "Comparador de Leyes" web de grado empresarial. El propósito de la aplicación es permitir a los usuarios ingerir dos textos legislativos (la ley original y una enmienda propuesta), ejecutar algoritmos de cálculo de diferencias (diffing) y utilizar IA para sintetizar el impacto legal.
Stack Tecnológico y Dependencias Estrictas
Framework Core: Next.js 14+ usando el paradigma de App Router (app/).
Tipado: TypeScript estricto. Todas las interfaces de datos deben estar explícitamente definidas.
Estilos de UI: Tailwind CSS. Utiliza una biblioteca de componentes primitivos accesible como Radix UI o shadcn/ui.
Motor de Cálculo de Diferencias: Instala diff-match-patch-es o diff-match-patch-ts (https://github.com/rars/diff-match-patch-ts).
Visor de Diferencias (Diff Viewer): Instala @monaco-editor/react (https://github.com/suren-atoyan/monaco-react).
Integración LLM: Instala el SDK oficial de openai.
Extracción de Archivos (Opcional para MVP, asume texto plano primero): pdf-parse si decides implementar subida de binarios.
Fases de Desarrollo y Complejidad (Métricas de Control para el Agente)
FASE 1: Estructura Base y UI de Ingesta (Complejidad: Básica - Agente Sugerido: GPT-4o-mini o Claude 3 Haiku)
Crea la interfaz de usuario en app/page.tsx. Debe contener un diseño limpio (Tailwind) con dos grandes paneles de entrada de texto (TextArea) titulados "Estatuto Vigente" y "Propuesta de Enmienda". Añade un botón primario "Analizar Impacto y Comparar". Implementa la gestión del estado (usando useState o React Hook Form) para capturar ambos textos de manera eficiente.
FASE 2: Lógica de Diferenciación en el Servidor (Complejidad: Media - Agente Sugerido: Claude 3.5 Sonnet)
Crea una Server Action en Next.js (o una ruta API en app/api/compare/route.ts).
Esta ruta recibe originalText y modifiedText.
Instancia la clase DiffMatchPatch.
ESTRICTO: Ejecuta la función diff_main(originalText, modifiedText).
ESTRICTO: Debes ejecutar inmediatamente diff_cleanupSemantic(diffs) sobre el resultado. Esto es innegociable, ya que colapsa cambios a nivel de carácter en cambios a nivel de palabra para mejorar la legibilidad humana.
Retorna la estructura JSON limpia al frontend.
FASE 3: Análisis de IA Integrado (Complejidad: Crítica - Agente Sugerido: GPT-4o)
Dentro de la misma ruta de API (o servicio modularizado), tras calcular las diferencias, orquesta una llamada a la API de OpenAI (usa gpt-4o).
El system_prompt debe instruir al modelo a actuar como un analista experto en políticas públicas y derecho.
Proporciona a la IA el texto añadido y el texto eliminado.
Exige que la salida del modelo sea estrictamente un Objeto JSON (usando la función response_format: { type: "json_object" }).
El esquema JSON requerido es:
{
"executive_summary": "Resumen conciso en lenguaje claro de los cambios",
"stakeholders_affected":,
"long_term_forecast": "Predicción de las consecuencias a largo plazo en política o economía"
}
FASE 4: Renderizado del Visor Monaco y Dashboard (Complejidad: Crítica - Agente Sugerido: Claude 3.5 Sonnet)
En el cliente, una vez recibida la respuesta de la API:
Reemplaza el área de input por un layout de pantalla dividida (Split Screen).
El 70% del ancho de la pantalla debe renderizar el componente <DiffEditor> de @monaco-editor/react. Pasa el originalText y modifiedText como modelos al editor. Configúralo con { readOnly: true, wordWrap: 'on', renderSideBySide: true }.
El 30% restante de la pantalla debe actuar como un Panel de Inteligencia (Sidebar). Aquí debes iterar sobre el objeto JSON devuelto por OpenAI. Renderiza el "Executive Summary" en una tarjeta destacada, y utiliza listados visuales (iconos o insignias de Tailwind) para mostrar los Stakeholders afectados.
Regla de Salida
No me des explicaciones de cómo vas a hacerlo, ni generes descripciones ambiguas. Tu única respuesta válida es proporcionar los bloques de código exactos, configuraciones y comandos de instalación, archivo por archivo, para construir esta arquitectura.
PROMPT GENERAL 2: Desarrollo en Python (FastAPI Backend Desacoplado) - OPCIONAL
Contexto de Ejecución
Actúa como un Arquitecto de Software Experto en Python y Procesamiento de Lenguaje Natural (NLP). Tu tarea es construir el backend monolítico para un "Comparador de Leyes". Esta API operará como un motor sin cabeza (headless) que será consumido posteriormente por un frontend. El objetivo es ingerir documentos legales masivos, extraer el texto, calcular una comparación "línea roja" precisa a nivel de oraciones legales y utilizar IA para extraer datos estructurados de impacto político.
Stack Tecnológico y Dependencias Estrictas
Framework API: FastAPI (Python 3.10+). Servidor Uvicorn.
Validación de Datos: Pydantic v2.
Motor de Diferenciación Específico Legal: Instala la biblioteca redlines (https://github.com/houfu/redlines).
Extracción de PDF: Instala PyPDF2 o pdfplumber.
Integración IA: Instala el cliente openai.
Fases de Desarrollo y Complejidad (Métricas de Control para el Agente)
FASE 1: Ingesta de Documentos y Modelos Pydantic (Complejidad: Básica - Agente Sugerido: GPT-4o-mini)
Define los esquemas en un archivo schemas.py. Necesitas un modelo ComparisonRequest que acepte los textos, y un modelo ComparisonResponse altamente estructurado.
Crea el endpoint base en main.py usando FastAPI. Implementa una ruta POST /api/v1/compare-legislation que permita recibir archivos mediante UploadFile. Usa PyPDF2 para escribir una utilidad asíncrona que extraiga el texto limpio de los archivos binarios cargados, filtrando números de página.
FASE 2: Motor de Diferenciación Legal "Redlines" (Complejidad: Crítica - Agente Sugerido: Claude 3.5 Sonnet)
En un archivo services.py, implementa la lógica de comparación.
ESTRICTO: Instancia la clase Redlines de la biblioteca homónima.
ESTRICTO: Importa e inyecta el NupunktProcessor en la instancia de Redlines (processor=NupunktProcessor()). Esto es vital para asegurar que las abreviaturas legales (ej. "Sec.", "U.S.C.") no rompan la tokenización a nivel de oración.
Genera la salida llamando al método que retorna el output en formato JSON estructurado o Markdown con marcas semánticas, de forma que el cliente pueda renderizar las inserciones y eliminaciones fácilmente.
FASE 3: Agente Documental de Impacto con OpenAI (Complejidad: Media - Agente Sugerido: GPT-4o)
Escribe un servicio asíncrono para interactuar con la API de OpenAI.
Crea un system_prompt que defina a la IA como un consultor de asuntos gubernamentales.
Concatena el resultado de las diferencias obtenidas por redlines y envíalas al modelo.
Emplea "Function Calling" o "JSON Mode" para forzar al modelo a devolver un análisis predecible.
El modelo debe extraer:
policy_changes_summary: Resumen de los cambios en la política.
fiscal_impact: Si se añaden o eliminan referencias a fondos, montos presupuestarios o impuestos.
affected_groups: Lista de entidades impactadas.
FASE 4: Consolidación y Manejo de Errores (Complejidad: Básica - Agente Sugerido: Claude 3 Haiku)
Consolida la ruta final de FastAPI. El endpoint debe inyectar la carga del documento en el servicio de redlines, esperar la respuesta estructurada, enviar los deltas a OpenAI de forma concurrente, y luego ensamblar ambas respuestas en el objeto ComparisonResponse de Pydantic.
Implementa un manejo global de excepciones (HTTPException) para manejar documentos corruptos, textos vacíos o caídas en la API de OpenAI por límites de tasa (rate limits).
Regla de Salida
Tu única respuesta válida es proporcionar el código fuente exhaustivo, comenzando por requirements.txt, seguido de main.py, schemas.py y services.py. Todo el código debe estar fuertemente tipado mediante Type Hints en Python y contar con comentarios de documentación profesional (docstrings).
El despliegue de las tecnologías expuestas y la segmentación del ciclo de vida del software mediante arquitecturas agénticas previene la saturación de los recursos de inferencia, asegurando el desarrollo de una herramienta analítica legal con estándares de grado corporativo. Se ratifica la recomendación de consolidar el proyecto en el ecosistema de TypeScript por su inigualable capacidad de orquestación de la Interfaz de Usuario a través del Editor Monaco y React, manteniendo la infraestructura en un solo repositorio altamente gobernable y directamente desplegable en infraestructuras edge.