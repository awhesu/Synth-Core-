# Remaining Work (20%)

## Current Status

### ✅ Completed (80% Truth Layer)

**Infrastructure:**
- ✅ All 7 NestJS microservices exist and are structured
- ✅ OpenAPI v0.1 contract with modular YAML stitching
- ✅ API scripts (api:lint, api:bundle, api:gen-types, api:sync) functional
- ✅ libs/contracts exports generated api-types.ts
- ✅ Prisma schema includes all required models:
  - Order (with originalAmount, discountAmount, discountCode)
  - PaymentIntent
  - RefundIntent
  - WebhookInbox
  - LedgerEntry (with walletSeq, prevHash, entryHash)
  - WalletBalanceCache
- ✅ **Critical invariant verified:** Only settlement-service writes ledger entries
- ✅ **Append-only pattern enforced:** No ledger updates or deletes found
- ✅ Jest test coverage started for settlement-service

### 🚧 Remaining Work

The following tasks represent the final 20% to production readiness.

---

## Task Breakdown

### 1. Complete Discount Subsidy Logic
**Owner:** Sam  
**Epic:** Platform Subsidy Engine

**Acceptance Criteria:**
- [ ] settlement-service correctly calculates `platformSubsidyAmount` from `Order.discountAmount`
- [ ] Ledger entries include subsidy line items:
  - DR PLATFORM_SUBSIDY_WALLET
  - CR PLATFORM_ESCROW
- [ ] Tests cover:
  - Zero discount (no subsidy)
  - Partial discount (50% subsidy)
  - Full discount (100% subsidy)
  - Invalid discount codes (reject)
- [ ] API docs updated in `openapi/v0.1/modules/settlement.yaml`

---

### 2. Webhook Signature Verification
**Owner:** Stella  
**Epic:** Flutterwave Integration Hardening

**Acceptance Criteria:**
- [ ] webhook-service validates `X-Flw-Signature` header
- [ ] Invalid signatures return 401 Unauthorized
- [ ] WebhookInbox stores signature and validation status
- [ ] Replay attacks prevented via idempotency key check
- [ ] Tests cover:
  - Valid signature → process
  - Invalid signature → reject
  - Duplicate webhook → idempotent (no double-processing)
- [ ] Update `docs/WEBHOOKS.md` with signature validation steps

---

### 3. Ops Dashboard Backend
**Owner:** Collins  
**Epic:** Operations Visibility

**Acceptance Criteria:**
- [ ] ops-service exposes these endpoints:
  - `GET /v1/orders?status=PENDING_PAYMENT` (paginated)
  - `GET /v1/ledger/balance/:accountId`
  - `GET /v1/webhooks/failed` (last 100)
  - `POST /v1/refunds/:intentId/retry`
- [ ] All endpoints use libs/contracts types
- [ ] RBAC guard applied: only `ADMIN` role can access
- [ ] OpenAPI spec in `openapi/v0.1/modules/ops.yaml`
- [ ] Integration tests verify pagination and RBAC

---

### 4. CI/CD Pipeline + Railway Deployment
**Owner:** Uwana  
**Epic:** Production Deployment

**Acceptance Criteria:**
- [ ] `.github/workflows/api-contract.yml` fixed (pnpm + Nx compatible)
- [ ] CI runs on PR:
  - pnpm api:lint
  - pnpm nx test
  - pnpm nx build
- [ ] Railway config added:
  - `railway.json` or Procfile
  - Separate services for each microservice
  - Shared Postgres and Redis
- [ ] Environment variables documented in README
- [ ] Health checks respond within 2s
- [ ] Deployment tested in staging environment

---

## Definition of Done

A task is **DONE** when:
1. Code merged to `main` via PR
2. Tests pass in CI
3. API contract updated if endpoint changed
4. `libs/contracts/src/api-types.ts` regenerated and committed
5. Docs updated (if applicable)
6. Reviewed by at least one other team member

---

## Notes

- **No refactoring allowed** in this phase — focus on completing features
- **Settlement-service remains the only ledger writer** — this is non-negotiable
- **All API changes must update OpenAPI first**, then regenerate types
- **SETTLED status means paid** — EzGas must never trust payment provider redirects

