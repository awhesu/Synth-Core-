# Syntherium Platform Architecture

## Overview

Syntherium is an API-first infrastructure platform for LPG operations, providing order management, payment processing, settlement, and financial truth layer services. It serves as the backend for clients like EZGas while maintaining strict separation of concerns.

## Architecture Diagram (Conceptual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  EZGas   │  │  Future  │  │  Admin   │  │  Partner Apps    │   │
│  │  Mobile  │  │  Clients │  │  Portal  │  │  (White-label)   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
└───────┼─────────────┼─────────────┼─────────────────┼─────────────┘
        │             │             │                 │
        └─────────────┴──────┬──────┴─────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                       API GATEWAY                                    │
│  • OpenAPI spec serving                                             │
│  • Authentication                                                    │
│  • Rate limiting                                                     │
│  • Request routing                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      SERVICE LAYER                                   │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │ Orders        │  │ Intent        │  │ Webhook       │           │
│  │ Service       │  │ Service       │  │ Service       │           │
│  │               │  │               │  │               │           │
│  │ • Order CRUD  │  │ • Payment     │  │ • Store       │           │
│  │ • Lifecycle   │  │   Intents     │  │ • Dedupe      │           │
│  │ • Status      │  │ • Refund      │  │ • Verify      │           │
│  │               │  │   Intents     │  │ • Trigger     │           │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘           │
│          │                  │                  │                    │
│          │                  │                  ▼                    │
│          │                  │   ┌───────────────────────────┐      │
│          │                  │   │     Settlement Service    │      │
│          │                  │   │   ═══════════════════════ │      │
│          │                  │   │   ONLY LEDGER WRITER      │      │
│          │                  │   │                           │      │
│          │                  │   │   • Atomic transactions   │      │
│          │                  │   │   • Discount subsidies    │      │
│          │                  │   │   • Hash chain            │      │
│          │                  │   └───────────┬───────────────┘      │
│          │                  │               │                       │
│          │                  │               ▼                       │
│          │  ┌───────────────┴───────────────────────────┐          │
│          │  │           Ledger Service                   │          │
│          │  │           (READ ONLY)                      │          │
│          │  │                                            │          │
│          │  │   • Query entries                          │          │
│          │  │   • Get balances                           │          │
│          │  │   • Verify chain                           │          │
│          │  └───────────────────────────────────────────┘          │
│          │                                                          │
│          │  ┌───────────────────────────────────────────┐          │
│          │  │           Ops Service                      │          │
│          │  │           (RBAC Protected)                 │          │
│          │  │                                            │          │
│          │  │   • Webhook inbox search                   │          │
│          │  │   • Ledger entry search                    │          │
│          │  │   • Replay webhooks                        │          │
│          │  │   • Verify chain integrity                 │          │
│          │  └───────────────────────────────────────────┘          │
│          │                                                          │
└──────────┼──────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                        │  │
│  │                                                               │  │
│  │  Orders  │  PaymentIntents  │  WebhookInbox  │  LedgerEntries │  │
│  │          │                  │                │                │  │
│  │  OrderItems │ RefundIntents │                │ WalletBalanceCache │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Single Writer Pattern
Only `settlement-service` writes to the ledger. All other services are readers. This ensures:
- Atomic financial transactions
- Single point of truth
- Simplified audit trail

### 2. Hash Chain Integrity
Every ledger entry links to the previous entry via SHA256 hash:
- `entryHash = SHA256(prevHash + canonical_fields)`
- Detects tampering
- Provides verifiable audit trail

### 3. Append-Only Ledger
- Entries are NEVER updated or deleted
- Refunds create NEW entries
- Corrections create NEW entries
- Full history preserved

### 4. Idempotency
- Every operation is idempotent via unique references
- Same request → same result
- Safe to retry on failures

### 5. OpenAPI First
- OpenAPI spec is source of truth
- Types are generated from spec
- Contract changes are PR-gated

## Service Responsibilities

| Service | Writes Ledger? | Primary Role |
|---------|---------------|--------------|
| orders-service | ❌ | Order lifecycle management |
| intent-service | ❌ | Payment/refund intent creation |
| webhook-service | ❌ | Webhook storage, dedupe, verification |
| **settlement-service** | ✅ | **ONLY ledger writer** |
| ledger-service | ❌ | Ledger queries, balance, verification |
| ops-service | ❌ | Admin dashboard, audit tools |

## Financial Flow

```
Customer Payment:
1. Order created (orders-service)
2. Payment intent created (intent-service)
3. Customer pays via provider (Flutterwave/Paystack)
4. Webhook received (webhook-service)
5. Settlement triggered (settlement-service)
   └── Creates CREDIT to PLATFORM_ESCROW
   └── If discount: DEBIT MARKETING_WALLET + CREDIT PLATFORM_ESCROW
6. Payment intent marked SETTLED
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **API Spec**: OpenAPI 3.0.3
- **Monorepo**: Nx + pnpm
- **CI/CD**: GitHub Actions
