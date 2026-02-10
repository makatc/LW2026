# Dashboard Integration Module

Module A of the LegalWatch Comparador 2.0 - Handles integration with the Dashboard API for importing legal documents.

## Overview

This module provides a connector-based architecture for fetching legal documents from external sources (primarily the existing SUTRA Monitoring Dashboard). It implements the **Dashboard Importer** pattern as specified in the project requirements.

## Architecture

### Components

1. **LawSourceConnector Interface** - Abstract contract for data sources
2. **MockDashboardConnector** - Test implementation with fake data
3. **HttpDashboardConnector** - Production HTTP client with retry logic
4. **DashboardImportService** - Orchestrates imports and saves SourceSnapshots
5. **DashboardImportController** - REST endpoints for triggering imports

### Design Pattern

The module uses the **Strategy Pattern** via dependency injection. The connector implementation is selected at runtime based on the `DASHBOARD_CONNECTOR_MODE` environment variable:

- `mock` → Uses MockDashboardConnector (development/testing)
- `http` → Uses HttpDashboardConnector (production)

## API Endpoints

### POST `/import/dashboard`

Import a single version from the dashboard.

**Request Body:**
```json
{
  "itemId": "law-123",
  "versionId": "version-1" // optional - imports latest if omitted
}
```

**Response:**
```json
{
  "snapshotId": "uuid",
  "itemId": "law-123",
  "versionId": "version-1",
  "sha256Hash": "abc123...",
  "isNew": true
}
```

### POST `/import/dashboard/multiple`

Import multiple versions for comparison.

**Request Body:**
```json
{
  "itemId": "law-123",
  "versionIds": ["version-1", "version-2"]
}
```

**Response:**
```json
[
  { "snapshotId": "uuid1", "itemId": "law-123", "versionId": "version-1", ... },
  { "snapshotId": "uuid2", "itemId": "law-123", "versionId": "version-2", ... }
]
```

## Environment Configuration

```bash
# Connector mode: 'mock' or 'http'
DASHBOARD_CONNECTOR_MODE=mock

# HTTP Connector settings (only needed when mode=http)
DASHBOARD_API_URL=http://localhost:3001
DASHBOARD_API_KEY=your-api-key-here
DASHBOARD_API_TIMEOUT=30000
DASHBOARD_API_MAX_RETRIES=3
```

## Features

### Deduplication
The service calculates SHA256 hashes of document content to prevent duplicate imports. If a document with the same content hash already exists, the existing snapshot is returned.

### Retry Logic
The HttpDashboardConnector includes exponential backoff retry logic for transient network failures:
- Initial retry: 2 seconds
- Second retry: 4 seconds
- Third retry: 8 seconds

### Error Handling
All connector methods include comprehensive error handling and logging. Failed imports throw descriptive errors that can be caught and handled by calling code.

## Testing

The module includes comprehensive unit tests for the DashboardImportService:

```bash
npm test -- dashboard-import.service.spec.ts
```

**Test Coverage:**
- ✓ Import document and create new snapshot
- ✓ Return existing snapshot for duplicate content
- ✓ Import latest version when versionId not specified
- ✓ Handle document not found errors
- ✓ Handle no versions available errors
- ✓ Import multiple versions successfully

## Usage Example

### Using MockDashboardConnector (Development)

1. Set `DASHBOARD_CONNECTOR_MODE=mock` in your `.env` file
2. The mock connector includes sample legal documents:
   - `law-123`: Ley de Protección de Datos Personales (2 versions)
   - `law-456`: Código de Comercio (1 version)

```bash
# Import latest version
curl -X POST http://localhost:3000/import/dashboard \
  -H "Content-Type: application/json" \
  -d '{"itemId": "law-123"}'

# Import specific version
curl -X POST http://localhost:3000/import/dashboard \
  -H "Content-Type: application/json" \
  -d '{"itemId": "law-123", "versionId": "version-123-v2"}'

# Import multiple versions for comparison
curl -X POST http://localhost:3000/import/dashboard/multiple \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "law-123",
    "versionIds": ["version-123-v1", "version-123-v2"]
  }'
```

### Using HttpDashboardConnector (Production)

1. Set `DASHBOARD_CONNECTOR_MODE=http` in your `.env` file
2. Configure the Dashboard API URL and credentials
3. The connector will make authenticated HTTP requests to the external API

**Expected API Contract:**

The external Dashboard API should implement these endpoints:

- `GET /api/laws/search?q={query}&page={page}&pageSize={pageSize}`
- `GET /api/laws/{itemId}`
- `GET /api/laws/{itemId}/versions`
- `GET /api/versions/{versionId}/text`

## Next Steps

This module provides the foundation for importing legal documents. The next phases will:

1. **Module B**: Parse and structure the imported documents
2. **Module C**: Generate embeddings and align document chunks
3. **Module D**: Perform semantic comparison between versions
4. **Module E**: Generate executive summaries and reports

## Dependencies

- `@nestjs/axios` - HTTP client wrapper
- `axios` - HTTP requests
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation
- TypeORM - Database integration
