# Syntherium Platform

API-first infrastructure platform for LPG operations, providing order management, payments, settlement, and financial truth layer services.

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed database with system accounts
pnpm db:seed

# Generate API types from OpenAPI
pnpm api:sync

# Build all services
pnpm build

# Run tests
pnpm test
```

## Architecture

See [docs/architecture/one-page-architecture.md](docs/architecture/one-page-architecture.md) for the full architecture overview.

### Key Services

| Service | Port | Description |
|---------|------|-------------|
| api-gateway | 3000 | Unified API entry point |
| intent-service | 3001 | Payment/refund intent management |
| webhook-service | 3002 | Webhook processing |
| settlement-service | 3003 | **ONLY ledger writer** |
| ledger-service | 3004 | Ledger queries |
| orders-service | 3005 | Order lifecycle |
| ops-service | 3006 | Operations dashboard |

### Critical Invariants

1. **Only `settlement-service` writes ledger entries**
2. **Ledger is append-only** - entries are never updated or deleted
3. **Hash chain integrity** - each entry links to previous via SHA256
4. **SETTLED means paid** - EZGas must never trust payment redirects

## Project Structure

```
syntherium/
├── apps/
│   ├── api-gateway/        # API entry point
│   ├── intent-service/     # Payment intents
│   ├── webhook-service/    # Webhook processing
│   ├── settlement-service/ # LEDGER WRITER
│   ├── ledger-service/     # Ledger queries
│   ├── orders-service/     # Order management
│   └── ops-service/        # Admin tools
├── libs/
│   ├── contracts/          # Generated API types
│   ├── db/                 # Prisma schema
│   ├── ledger-core/        # Ledger operations
│   ├── security/           # RBAC guards
│   ├── idempotency/        # Idempotency helpers
│   └── observability/      # Logging
├── openapi/
│   └── v0.1/              # OpenAPI specifications
├── docs/
│   └── architecture/      # Architecture docs
└── .github/
    └── workflows/         # CI/CD
```

## OpenAPI Contract Pipeline

```bash
# Lint OpenAPI specs
pnpm api:lint

# Bundle OpenAPI specs
pnpm api:bundle

# Generate TypeScript types
pnpm api:gen-types

# All in one
pnpm api:sync
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/syntherium
FLUTTERWAVE_SECRET_HASH=your_secret_hash
NODE_ENV=development
```

## Documentation

- [One-Page Architecture](docs/architecture/one-page-architecture.md)
- [Module Map](docs/architecture/module-map.md)
- [Syntherium vs EZGas Doctrine](docs/architecture/syntherium-vs-ezgas-doctrine.md)

## License

Proprietary - SyncTech Innovations
