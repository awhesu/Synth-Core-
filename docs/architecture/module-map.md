# Syntherium Domain to API Module Mapping

This document maps Syntherium's six core domains to their corresponding API modules and services.

## Domain Overview

| # | Domain | Service(s) | Status |
|---|--------|-----------|--------|
| 1 | Orders & Transaction Management | orders-service | ✅ Implemented |
| 2 | Gas Movement & Inventory Truth | movement-service | 🚧 Stub |
| 3 | Financial Truth Layer | intent, webhook, settlement, ledger | ✅ Implemented |
| 4 | Marketplace & Network | marketplace-service | 🚧 Stub |
| 5 | Carbon Tracking | carbon-service | 🚧 Stub |
| 6 | Intelligence/AI Readiness | analytics pipeline | 🚧 Stub |

---

## 1. Orders & Transaction Management

**Services**: `orders-service`  
**API Module**: `/v1/orders`

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/orders` | Create new order |
| GET | `/v1/orders/:id` | Get order by ID |
| POST | `/v1/orders/:id/accept` | Vendor accepts order |
| POST | `/v1/orders/:id/dispatch` | Mark as dispatched |
| POST | `/v1/orders/:id/deliver` | Mark as delivered |
| POST | `/v1/orders/:id/cancel` | Cancel order |
| GET | `/v1/orders/:id/financial-status` | Get payment status |

---

## 2. Gas Movement & Inventory (STUB)

**Status**: 🚧 To be implemented

---

## 3. Financial Truth Layer

### Intent Service (`/v1/intents/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/intents/payments` | Create payment intent |
| GET | `/v1/intents/payments/:id` | Get payment intent |
| POST | `/v1/intents/refunds` | Create refund intent |
| GET | `/v1/intents/refunds/:id` | Get refund intent |

### Webhook Service (`/v1/webhooks/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/webhooks/flutterwave` | Flutterwave webhook |

### Ledger Service (`/v1/ledger/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/ledger/entries` | Query ledger entries |
| GET | `/v1/wallets/:accountId/balance` | Get wallet balance |
| POST | `/v1/ledger/verify-chain` | Verify chain integrity |

---

## 4-6. Future Domains (STUB)

Marketplace, Carbon, and Intelligence domains are stubbed for future implementation.

---

## Operations (`/v1/ops/*`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/v1/ops/webhook-inbox` | ops/admin | Search webhooks |
| GET | `/v1/ops/ledger-entries` | ops/admin | Search ledger |
| POST | `/v1/ops/replay-webhook` | admin | Replay webhook |
| POST | `/v1/ops/verify-chain` | ops/admin | Verify chains |
