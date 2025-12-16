# API Contract Documentation

## Overview

Syntherium uses OpenAPI 3.0 as the single source of truth. The contract lives in `openapi/v0.1/`.

## Workflow

1. **Edit your module** in `openapi/v0.1/modules/your-service.yaml`
2. **Lint**: `pnpm api:lint`
3. **Generate types**: `pnpm api:sync`
4. **Commit** both the module YAML and generated `libs/contracts/src/api-types.ts`

## Payment Status Doctrine

**CRITICAL:** Only `SETTLED` means paid.

- `PENDING_PAYMENT` → User redirected to payment provider
- `PROCESSING` → Webhook received
- `SETTLED` → Payment confirmed, ledger written
- `FAILED` → Payment failed

**Never trust payment provider redirects.** Always wait for webhook confirmation.
