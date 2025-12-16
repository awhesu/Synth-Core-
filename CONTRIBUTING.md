# Contributing to Syntherium

Thank you for contributing to the Syntherium platform! This guide ensures consistency and quality across the codebase.

## Core Principles

### 1. OpenAPI is the Source of Truth

**The API contract defines the system.** All endpoints, request/response shapes, and errors are specified in OpenAPI YAML files before any code is written.

```
openapi/v0.1/
├── openapi.yaml          # Root file that stitches everything
└── modules/
    ├── orders.yaml
    ├── intent.yaml
    ├── settlement.yaml
    └── ...
```

### 2. Engineers Edit Only Their Module YAML

- **Orders team?** Edit `openapi/v0.1/modules/orders.yaml`
- **Settlement team?** Edit `openapi/v0.1/modules/settlement.yaml`
- **Never edit** `openapi.yaml` directly (it just stitches modules)
- **Never edit** `libs/contracts/src/api-types.ts` manually (it's generated)

### 3. Run `pnpm api:sync` and Commit Generated Types

After editing any OpenAPI module:

```bash
pnpm api:sync
git add openapi/v0.1/modules/your-module.yaml
git add libs/contracts/src/api-types.ts
git commit -m "feat(api): Add endpoint for X"
```

This ensures:
- TypeScript types stay in sync with the contract
- Frontend/backend can import from `@syntherium/contracts`
- Redocly docs are always up-to-date

### 4. Only Settlement-Service Writes Ledger Entries

**This is non-negotiable.**

- `apps/settlement-service` is the **single writer** for the ledger
- All other services are **read-only** on ledger data
- Violating this breaks the append-only guarantee and financial integrity

**Forbidden:**
```typescript
// ❌ NEVER do this in orders-service, intent-service, etc.
await prisma.ledgerEntry.create({ ... });
```

**Correct:**
```typescript
// ✅ Only in settlement-service
await ledgerService.appendEntry({ ... });
```

---

## Workflow

### Branch Naming

```
feat/add-refund-endpoint
fix/discount-calculation
docs/update-onboarding
chore/upgrade-prisma
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(orders): Add discount code validation
fix(settlement): Correct subsidy ledger entry
docs(api): Document webhook signature verification
chore(ci): Fix api-contract workflow
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `chore`: Build, CI, tooling
- `refactor`: Code restructuring (no behavior change)
- `test`: Adding or fixing tests

**Scope** (in parentheses) should be the service or module:
- `(orders)`, `(settlement)`, `(api)`, `(ci)`, etc.

---

## Pull Request Rules

### Before Opening a PR

1. **Run tests:**
   ```bash
   pnpm nx test
   ```

2. **Lint OpenAPI:**
   ```bash
   pnpm api:lint
   ```

3. **Regenerate types if you changed OpenAPI:**
   ```bash
   pnpm api:sync
   ```

4. **Check that you're on the right branch:**
   ```bash
   git status
   ```

### PR Template

When you open a PR, the template will appear with this checklist:

- [ ] OpenAPI updated (if needed)
- [ ] `pnpm api:sync` ran
- [ ] `libs/contracts/src/api-types.ts` committed (if changed)
- [ ] `pnpm nx test` passed
- [ ] No forbidden ledger writes introduced
- [ ] Docs updated if contract changed

**Do not skip checklist items.** If something doesn't apply, explain why in the PR description.

### Review Process

- **Minimum 1 approval** required
- **Sam or Stella** must approve any settlement-service or ledger changes
- **CI must pass** (api-contract check, tests, build)
- **Merge strategy:** Squash and merge (keeps `main` clean)

---

## Testing

### Running Tests

```bash
# All tests
pnpm nx test

# Single service
pnpm nx test settlement-service

# Watch mode
pnpm nx test settlement-service --watch
```

### Test Coverage Requirements

- **Critical paths:** 80%+ coverage (settlement, ledger, intent)
- **Happy path + error cases** required for all endpoint handlers
- **Idempotency** must be tested (duplicate webhooks, retries)

---

## Local Development

See [`docs/ONBOARDING.md`](./docs/ONBOARDING.md) for setup instructions.

**Quick start:**
```bash
docker-compose up -d postgres redis
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

---

## Troubleshooting

### "OpenAPI lint failed"
```bash
pnpm api:lint
# Fix errors in your module YAML
```

### "Generated types don't match"
```bash
pnpm api:sync
git add libs/contracts/src/api-types.ts
```

### "Prisma client out of date"
```bash
pnpm db:generate
```

### "Port already in use"
```bash
lsof -i :3005  # Find the process
kill -9 <PID>  # Kill it
```

---

## Questions?

- Check [`docs/ONBOARDING.md`](./docs/ONBOARDING.md)
- Check [`docs/API.md`](./docs/API.md)
- Ask in the team chat
- Open a draft PR and tag someone

---

## License

Proprietary. See LICENSE file.
