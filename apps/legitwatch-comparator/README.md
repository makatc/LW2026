# LegalWatch Comparador 2.0

A NestJS-based law comparison engine that imports, processes, and compares legal documents from external sources. The system detects structural changes, generates diffs, and identifies semantic changes in legal texts.

## 🏗️ Architecture Overview

The application is built as a modular monolith with the following modules:

- **Module A: Dashboard Integration** - Imports law documents from external dashboards
- **Module B: Documents & Ingestion** - Processes documents and extracts structural chunks
- **Module C: Common** - Shared utilities and logging (Pino)
- **Module D: Comparison Engine** - Compares document versions and detects changes
- **Module E: Reports** - Exports comparison results and summaries

### Technology Stack

- **Framework**: NestJS (Node.js 20+, TypeScript strict mode)
- **Database**: PostgreSQL 16 with pgvector extension
- **Cache/Queue**: Redis + BullMQ for async job processing
- **ORM**: TypeORM with migrations
- **Logging**: Pino structured logging
- **Diff Engine**: Google's diff-match-patch

## 📋 Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm or pnpm

## 🚀 Quick Start

### 1. Start Infrastructure with Docker Compose

The application requires PostgreSQL (with pgvector) and Redis:

```bash
# From the project root, start the containers
docker-compose up -d

# Verify containers are running
docker-compose ps
```

This will start:
- **PostgreSQL 16** (port 5433) with pgvector extension
- **Redis 7** (port 6379) for BullMQ job queues

### 2. Install Dependencies

```bash
cd apps/legitwatch-comparator
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `apps/legitwatch-comparator` directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=lwuser
DB_PASSWORD=lwpassword
DB_NAME=legitwatch_comparator

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
NODE_ENV=development
PORT=3000

# Dashboard API (for HttpDashboardConnector)
DASHBOARD_API_URL=https://api.example.com/laws
DASHBOARD_API_KEY=your-api-key-here
```

### 4. Run Database Migrations

```bash
# Generate migration (if needed)
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run
```

### 5. Start the Application

```bash
# Development mode with watch
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`

## 🔄 Complete Workflow: Import → Ingest → Compare → Report

### Step 1: Import from Dashboard

Import a law document from the external dashboard:

```bash
# Using MockDashboardConnector (for testing)
curl -X POST http://localhost:3000/import/dashboard \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "ley-organica-15-1999",
    "connectorType": "mock"
  }'

# Using HttpDashboardConnector (production)
curl -X POST http://localhost:3000/import/dashboard \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "your-law-id",
    "connectorType": "http"
  }'
```

Response:
```json
{
  "success": true,
  "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Imported 2 versions successfully"
}
```

### Step 2: Ingest and Process

Queue a job to process the imported snapshot and extract document chunks:

```bash
curl -X POST http://localhost:3000/documents/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Response:
```json
{
  "jobId": "123",
  "status": "added",
  "message": "Ingestion job queued"
}
```

Check job status:
```bash
curl http://localhost:3000/documents/jobs/123
```

### Step 3: Compare Versions

Compare two document versions:

```bash
curl -X POST http://localhost:3000/comparison/compare \
  -H "Content-Type: application/json" \
  -d '{
    "sourceVersionId": "version-1-uuid",
    "targetVersionId": "version-2-uuid"
  }'
```

Response:
```json
{
  "jobId": "456",
  "status": "added",
  "message": "Comparison job queued"
}
```

Check comparison job:
```bash
curl http://localhost:3000/comparison/jobs/456
```

Get comparison result:
```bash
curl http://localhost:3000/comparison/results/comparison-uuid
```

### Step 4: Get Report Summary

Retrieve a detailed project summary:

```bash
curl http://localhost:3000/projects/comparison-uuid/summary
```

Response:
```json
{
  "comparisonId": "comparison-uuid",
  "status": "COMPLETED",
  "sourceDocument": {
    "id": "doc-1",
    "title": "Ley Orgánica 15/1999",
    "versionId": "version-1-uuid",
    "versionTag": "1.0"
  },
  "targetDocument": {
    "id": "doc-2",
    "title": "Ley Orgánica 15/1999",
    "versionId": "version-2-uuid",
    "versionTag": "2.0"
  },
  "summary": "Major obligation shifts detected in articles 12 and 15...",
  "impactScore": 75,
  "totalChanges": 23,
  "chunkComparisons": [
    {
      "sourceChunkId": "chunk-1",
      "targetChunkId": "chunk-2",
      "diffHtml": "<span>Artículo 12. El titular </span><del>deberá</del><ins>podrá</ins>...",
      "changeType": "obligation_shift",
      "impactScore": 0.85
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

Export to PDF (mock):
```bash
curl http://localhost:3000/projects/comparison-uuid/export
```

Response:
```json
{
  "message": "PDF Generation Pending",
  "comparisonId": "comparison-uuid",
  "status": "queued"
}
```

## 📊 API Endpoints Reference

### Dashboard Integration
- `POST /import/dashboard` - Import law from dashboard

### Document Ingestion
- `POST /documents/ingest` - Queue document processing job
- `GET /documents/jobs/:jobId` - Check ingestion job status
- `GET /documents/:documentId` - Get document details
- `GET /documents/:documentId/versions` - List document versions
- `GET /documents/:documentId/versions/:versionId` - Get version details

### Comparison
- `POST /comparison/compare` - Queue comparison job
- `GET /comparison/jobs/:jobId` - Check comparison job status
- `GET /comparison/results/:comparisonId` - Get comparison result
- `GET /comparison/queue/stats` - Get queue statistics

### Reports
- `GET /projects/:comparisonId/summary` - Get project summary (enriched)
- `GET /projects/:comparisonId/export` - Export to PDF (mock)
- `GET /projects/:comparisonId/result` - Get raw comparison result

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- reports.service.spec.ts

# Watch mode
npm test -- --watch
```

Current test coverage: **46 tests** across 5 test suites

## 🗄️ Database Schema

### Core Entities

- **documents** - Parent law documents
- **document_versions** - Versions of a document
- **document_chunks** - Structural chunks (articles, chapters) with embeddings
- **source_snapshots** - Immutable import records
- **comparison_results** - Comparison outputs with diffs and semantic changes

### Relationships

```
Document (1) -> (*) DocumentVersion
DocumentVersion (1) -> (*) DocumentChunk
SourceSnapshot -> Document/DocumentVersion (reference only)
ComparisonResult -> DocumentVersion (source + target)
```

## 🔧 Development Scripts

```bash
# Development
npm run start:dev          # Start with watch mode
npm run build              # Build for production
npm run start:prod         # Run production build

# Database
npm run typeorm            # TypeORM CLI
npm run migration:generate # Generate migration
npm run migration:run      # Run migrations
npm run migration:revert   # Revert last migration

# Testing
npm test                   # Run tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report

# Linting
npm run lint               # Run ESLint
npm run format             # Run Prettier
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Access PostgreSQL
docker exec -it lwbeta-postgres-1 psql -U lwuser -d legitwatch_comparator

# Access Redis CLI
docker exec -it lwbeta-redis-1 redis-cli
```

## 🏗️ Project Structure

```
apps/legitwatch-comparator/
├── src/
│   ├── common/                 # CommonModule (logger, utilities)
│   ├── dashboard-integration/  # Module A: Import connectors
│   │   ├── connectors/
│   │   │   ├── mock-dashboard.connector.ts
│   │   │   └── http-dashboard.connector.ts
│   │   ├── dashboard-import.service.ts
│   │   └── dashboard-import.controller.ts
│   ├── documents/             # Module B: Ingestion & processing
│   │   ├── services/
│   │   │   ├── structure-detector.service.ts
│   │   │   ├── normalizer.service.ts
│   │   │   └── ingestion.service.ts
│   │   ├── processors/
│   │   │   └── ingestion.processor.ts
│   │   └── documents.controller.ts
│   ├── comparison/            # Module D: Comparison engine
│   │   ├── services/
│   │   │   ├── diff.service.ts
│   │   │   └── comparison.service.ts
│   │   ├── processors/
│   │   │   └── compare.processor.ts
│   │   ├── interfaces/
│   │   │   └── semantic-change-detector.interface.ts
│   │   └── comparison.controller.ts
│   ├── reports/               # Module E: Reports & export
│   │   ├── reports.service.ts
│   │   └── reports.controller.ts
│   ├── entities/              # TypeORM entities
│   │   ├── document.entity.ts
│   │   ├── document-version.entity.ts
│   │   ├── document-chunk.entity.ts
│   │   ├── source-snapshot.entity.ts
│   │   └── comparison-result.entity.ts
│   ├── migrations/            # Database migrations
│   └── app.module.ts          # Root module
├── test/                      # E2E tests
├── docker-compose.yml         # Infrastructure setup
├── tsconfig.json             # TypeScript config (strict mode)
└── package.json              # Dependencies
```

## 🔍 Key Features

### Structure Detection
Automatically detects Spanish legal document structures:
- **ARTÍCULO** / **Art.** - Individual articles
- **CAPÍTULO** - Chapters
- **SECCIÓN** - Sections
- **PÁRRAFO** - Paragraphs

### Semantic Change Detection
Identifies 12 types of semantic changes:
- Obligation shifts (mandatory → optional)
- Sanction modifications
- Definition changes
- Scope expansions/reductions
- Temporal modifications
- Quantitative changes
- And more...

### Text Normalization
- Removes headers, footers, page numbers
- Cleans PDF artifacts
- Normalizes whitespace
- Preserves legal formatting

### Diff Generation
- Character-level diffs with `<ins>` and `<del>` tags
- Side-by-side HTML view
- Similarity scoring
- Impact assessment

## 🔒 Security Notes

- Never commit `.env` files
- Use environment variables for secrets
- Validate all user inputs
- Sanitize HTML output to prevent XSS
- Use parameterized queries (TypeORM handles this)

## 📝 TODO / Future Enhancements

- [ ] Implement AI-based semantic change detection (replace stub)
- [ ] Add PDF generation for exports
- [ ] Implement vector similarity search with pgvector
- [ ] Add authentication and authorization
- [ ] Create admin dashboard
- [ ] Add webhook notifications for completed jobs
- [ ] Implement rate limiting
- [ ] Add Swagger/OpenAPI documentation

## 🤝 Contributing

1. Follow TypeScript strict mode rules
2. Write unit tests for new features
3. Use conventional commit messages
4. Run linting before committing

## 📄 License

Proprietary - LegalWatch Comparador 2.0

---

**Built with ❤️ using NestJS**
