# LegalWatch Comparador 2.0

A production-grade, modular Law Comparison Engine built with NestJS and TypeScript.

## Overview

This application is designed to ingest two versions of a legal document, align them structurally, perform semantic diffing (detecting obligation shifts, penalties, definitions), and produce a UI-ready report with executive summaries.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS (Modular Monolith architecture)
- **Language:** TypeScript (Strict Mode enabled)
- **Database:** PostgreSQL 16 with pgvector extension
- **ORM:** TypeORM
- **Queue:** Redis + BullMQ (planned)
- **Logger:** Pino (structured logging)
- **Testing:** Jest + Supertest

## Project Structure

```
src/
├── common/              # Common module with logger configuration
├── entities/            # TypeORM entities
│   ├── document.entity.ts
│   ├── document-version.entity.ts
│   ├── document-chunk.entity.ts
│   └── source-snapshot.entity.ts
├── migrations/          # Database migrations
├── app.module.ts        # Main application module
├── main.ts             # Application entry point
└── data-source.ts      # TypeORM data source configuration
```

## Database Entities

### Document
Parent entity containing document metadata.

### DocumentVersion
Represents a specific version of a document (e.g., "Vigente", "Enmienda", "Proyecto").

**Status Enum:** `PROCESSING`, `READY`, `ERROR`

### DocumentChunk
Granular text blocks at Article/Section level with semantic embedding vectors (1536 dimensions).

**Types:** `ARTICLE`, `SECTION`, `PARAGRAPH`, `CHAPTER`

### SourceSnapshot
Immutable record of raw input with SHA256 hash for deduplication.

**Source Types:** `PDF`, `DOCX`, `HTML`, `TEXT`

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose
- npm or pnpm >= 8.0.0

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Database Setup

```bash
# Start PostgreSQL with pgvector and Redis
cd ../.. && docker-compose up -d

# Run migrations
npm run migration:run
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Available Scripts

- `npm run build` - Build the application
- `npm run start:dev` - Start in development mode with watch
- `npm run start:prod` - Start in production mode
- `npm run lint` - Lint the codebase
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run migration:generate -- src/migrations/MigrationName` - Generate a new migration
- `npm run migration:run` - Run pending migrations
- `npm run migration:revert` - Revert the last migration
- `npm run migration:show` - Show migration status

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5433)
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name (default: legitwatch_comparator)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Application port (default: 3000)

## Architecture & Modules (Planned)

### Module A: Dashboard Connector
Integrates with the existing Monitoring Dashboard to fetch legal texts.

### Module B: Documents & Ingestion
Handles document parsing and structure detection.

### Module C: Alignment & Embeddings
Performs hybrid alignment using lexical and semantic matching.

### Module D: Compare Engine
Generates diffs and detects semantic changes.

### Module E: Summaries & Reports
Creates executive summaries and exports reports.

### Module F: Analysis Context
Checks for conflicts and user impact.

## Development Guidelines

1. **TypeScript Strict Mode** - All code must pass strict type checking
2. **Test-Driven** - Write tests before implementation
3. **Error Handling** - All external calls must have retries and fallback logic
4. **Logging** - Use Pino logger for all logging needs
5. **Documentation** - Update documentation for every new feature/endpoint

## Next Steps

This is Phase 1 (Infrastructure). The following modules need to be implemented:
- Document ingestion and parsing services
- Alignment and embedding services
- Comparison engine
- Summary and report generation
- Dashboard connector integration

## License

UNLICENSED
