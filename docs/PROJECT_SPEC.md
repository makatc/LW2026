# LEGALWATCH COMPARATOR 2.0 - TECHNICAL SPECIFICATION (MASTER PLAN)

## 1. PROJECT OVERVIEW
**Product Name:** LegitWatch Comparador 2.0
**Role:** Senior Staff Engineer / LegalTech Architect
**Goal:** Build a production-grade, modular "Law Comparison Engine" in TypeScript/Node.js.
**Core Function:** Ingest two versions of a legal document (Source A vs. Source B), align them structurally, perform semantic diffing (detecting obligation shifts, penalties, definitions), and produce a UI-ready report with executive summaries.
**Critical Constraint:** The system must utilize a "Dashboard Importer" to consume official data from the existing Monitoring App (Noticias/SUTRA) via API or DB connection, strictly avoiding scraping where possible.

## 2. TECH STACK (STRICT & MANDATORY)
- **Runtime:** Node.js 20+ (TypeScript Strict Mode).
- **Framework:** NestJS (Modular Monolith architecture).
- **Database:** PostgreSQL (v15+) + `pgvector` extension (for semantic embeddings).
- **ORM:** TypeORM or Prisma (Must support vector types).
- **Queue/Async:** Redis + BullMQ (Mandatory for ingestion, chunking, and diffing jobs).
- **Parsing:** `pdf-parse` (PDF), `mammoth` (DOCX), `cheerio` (HTML), `tesseract.js` (OCR fallback).
- **Diff Engine:** `diff-match-patch` (Google) + Custom Semantic Layer.
- **AI/LLM:** Pluggable Interface (OpenAI/Anthropic/Local/Gemini) - **NO hardcoded keys**.
- **Observability:** `pino` (structured logging).
- **Testing:** Jest (Unit) + Supertest (E2E).

## 3. ARCHITECTURE & MODULES
The application must be divided into strictly isolated modules.

### MODULE A: Dashboard Connector (The "Importer") - **PRIORITY 1**
*Integrates with the existing Monitoring Dashboard to fetch legal texts.*
- **Interface:** `LawSourceConnector { search(query), listVersions(itemId), fetchVersionText(id), fetchMetadata(id) }`
- **Implementation Modes:**
  1.  **API Mode (Preferred):** Connects via HTTP + JWT/API Key. Resilient to rate limits.
  2.  **DB Mode (Fallback):** Read-only access to legacy tables (`monitored_items`, `item_versions`) if API is unavailable.
- **Output:** Standardized `SourceSnapshot` and `DocumentVersion` objects ready for the pipeline.
- **Constraint:** Must handle "Compare by Reference" (User selects ID 123 and ID 456 from Dashboard, system fetches them).

### MODULE B: Documents & Ingestion (The "Parser")
- **Entities:**
  - `Document` (Parent entity).
  - `DocumentVersion` (Specific iteration: "Vigente", "Enmienda", "Proyecto").
  - `SourceSnapshot` (Immutable record of the raw input: SHA256, payload, date).
- **Services:**
  - `IngestionService`: Routing based on file type (PDF/DOCX/HTML).
  - `StructureDetector`: Regex/Heuristic based detection of Articles, Chapters, Sections.
  - `Normalizer`: Cleans noise (headers, footers, line numbers).

### MODULE C: Alignment & Embeddings (The "Aligner")
- **Entities:**
  - `DocumentChunk` (Granular text blocks: Article/Section level with embedding vector).
- **Logic:** `HybridAligner`.
  - **Lexical:** TF-IDF/Keyword matching to find moved sections.
  - **Semantic:** Vector Cosine Similarity to find rewritten sections.
  - **Goal:** Map `Old_Article_5` to `New_Article_7` accurately.

### MODULE D: Compare Engine (The "Brain")
- **Services:**
  - `DiffEngine`: Generates character-level diffs for UI (`<ins>`, `<del>`).
  - `SemanticChangeDetector`: AI-assisted classification.
    - **Categories:** `obligation_shift` (deberá->podrá), `sanction_changed`, `definition_modified`, `scope_expanded`.
    - **Scoring:** Impact Score (0-100) based on category weight.

### MODULE E: Summaries & Reports (The "Output")
- **Services:**
  - `ExecutiveSummaryGenerator`: Creates "What Changed", "Why it Matters", "Who is Affected".
  - `ReportExporter`: Generates PDF/DOCX with:
    - Cover Page.
    - Executive Summary.
    - Side-by-Side Diff View.
- **API:** Endpoints to serve JSON data for the Frontend.

### MODULE F: Analysis Context (The "Value Add")
- **Services:**
  - `ContextAnalyzer`: Checks for conflicts with other laws in the database.
  - `UserImpact`: (Optional) Checks uploaded user contracts against new law changes.

## 4. DATA MODEL (CORE ENTITIES)

### `DocumentVersion`
- `id`: UUID
- `documentId`: UUID
- `versionTag`: String (e.g., "2024-Enmienda")
- `status`: Enum (PROCESSING, READY, ERROR)
- `normalizedText`: Text
- `metadata`: JSONB (Source URL, Author, Date)

### `DocumentChunk`
- `id`: UUID
- `versionId`: UUID
- `type`: Enum (ARTICLE, SECTION, PARAGRAPH)
- `label`: String (e.g., "Artículo 5")
- `content`: Text
- `embedding`: Vector(1536)
- `orderIndex`: Integer

### `ComparisonResult`
- `id`: UUID
- `sourceVersionId`: UUID
- `targetVersionId`: UUID
- `alignmentMap`: JSONB (Mapping of Old IDs to New IDs)
- `summary`: Text
- `impactScore`: Integer

## 5. DEVELOPMENT WORKFLOW (FOR AI AGENT)
1.  **Read Spec:** Always refer to this file for architectural decisions.
2.  **Step-by-Step:** Do not implement all modules at once. Wait for user confirmation between phases.
3.  **Test-Driven:** Write the Interface and a failing Test before the Implementation.
4.  **Error Handling:** All external calls (API/DB/AI) must have retries and fallback logic.
5.  **Documentation:** Update Swagger/OpenAPI for every new endpoint.