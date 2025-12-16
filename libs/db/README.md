# @syntherium/db

Database library for Syntherium platform using Prisma ORM.

## Setup

### 1. Configure Database URL

Set the `DATABASE_URL` environment variable:

```bash
# PostgreSQL connection string
export DATABASE_URL="postgresql://user:password@localhost:5432/syntherium?schema=public"
```

### 2. Generate Prisma Client

```bash
pnpm db:generate
```

### 3. Run Migrations

**Development (with migration creation):**
```bash
pnpm db:migrate
```

**Production (apply existing migrations):**
```bash
pnpm db:migrate:deploy
```

### 4. Seed Database

Creates system accounts required for platform operation:
- `MARKETING_WALLET` - Source for discount subsidies (initial 1M NGN)
- `PLATFORM_ESCROW` - Receives payments, holds funds
- `LEGACY_MIGRATION_WALLET` - For data migration entries

```bash
pnpm db:seed
```

## Schema Overview

### Core Models

| Model | Description |
|-------|-------------|
| `Order` | LPG order with items, delivery info, and status |
| `OrderItem` | Individual line items in an order |
| `PaymentIntent` | Payment request tracking customer charges and subsidies |
| `RefundIntent` | Refund request for settled payments |
| `WebhookInbox` | Raw webhook storage with deduplication |
| `LedgerEntry` | Immutable financial entries with hash chain |
| `WalletBalanceCache` | Derived balance cache for performance |

### Financial Invariants

1. **Amounts use Decimal(19,4)** - Four decimal precision for currency
2. **Ledger is append-only** - No UPDATE or DELETE on ledger entries
3. **Hash chain integrity** - Each entry links to previous via SHA256
4. **Idempotency** - Unique constraint on (accountId, reference)

### Payment Flow

```
amount = customer charge
originalAmount = full value of goods
discountAmount = subsidy = originalAmount - amount

If discountAmount > 0:
  - Marketing wallet is DEBITED
  - Platform escrow is CREDITED (subsidy portion)
```

## Usage

```typescript
import { PrismaClient } from '@syntherium/db';

const prisma = new PrismaClient();

// Query orders
const orders = await prisma.order.findMany({
  where: { status: 'PENDING' },
  include: { items: true },
});

// Get wallet balance
const balance = await prisma.walletBalanceCache.findUnique({
  where: { accountId: 'PLATFORM_ESCROW' },
});
```

## Migrations

Migrations are stored in `prisma/migrations/`. Never manually edit migration files after they've been applied to production.

### Creating a New Migration

```bash
# Make schema changes in schema.prisma, then:
pnpm db:migrate --name descriptive_name
```

### Migration History

| Migration | Description |
|-----------|-------------|
| `init` | Initial schema with all core models |
