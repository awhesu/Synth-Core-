# Onboarding Guide

Welcome to the Syntherium platform! This guide will get you up and running locally or in Codespaces.

## Prerequisites

- **Docker Desktop** (must be running)
- **Node.js 18+**
- **pnpm** (`npm install -g pnpm` if missing)
- **Git**

## Option 1: Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/awhesu/Synth-Core-.git
cd Synth-Core-
```

### 2. Start Docker Containers

Start PostgreSQL and Redis:

```bash
docker-compose up -d postgres redis
```

Verify containers are running:

```bash
docker ps
```

You should see:
- `syntherium-db` (PostgreSQL)
- `syntherium-redis` (Redis)

Wait for Postgres to be ready:

```bash
docker-compose exec postgres pg_isready -U syntherium
```

Keep running this until you see: `accepting connections`

### 3. Install Dependencies

```bash
pnpm install
```

This installs all packages for the Nx monorepo.

### 4. Generate Prisma Client

```bash
pnpm db:generate
```

This creates the Prisma client from `libs/db/prisma/schema.prisma`.

### 5. Run Database Migrations

```bash
pnpm db:migrate
```

If prompted for a migration name, use: `init`

This creates all tables in the PostgreSQL database.

### 6. Seed Database

```bash
pnpm db:seed
```

This creates system accounts:
- PLATFORM_ESCROW
- PLATFORM_SUBSIDY_WALLET
- MARKETING_WALLET

If you see "already seeded", that's fine.

### 7. Start All Services

```bash
pnpm dev
```

You should see 6 services start with colored output:
- `orders-service` on port 3005
- `intent-service` on port 3001
- `webhook-service` on port 3002
- `settlement-service` on port 3003
- `ledger-service` on port 3004
- `ops-service` on port 3006

### 8. Test Services

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3005/v1/health
```

Expected response:
```json
{"status":"healthy"}
```

Create a test order:

```bash
curl -X POST http://localhost:3005/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test_customer",
    "vendorId": "test_vendor",
    "items": [{
      "productId": "lpg_12kg",
      "productName": "12kg LPG Refill",
      "quantity": 1,
      "unitPrice": "5000.0000"
    }],
    "deliveryType": "DELIVERY"
  }'
```

Expected: JSON response with an `id` field.

---

## Option 2: GitHub Codespaces

### 1. Create Codespace

1. Go to the [GitHub repository](https://github.com/awhesu/Synth-Core-)
2. Click the green **Code** button
3. Select **Codespaces** tab
4. Click **Create codespace on main**

Wait 2-3 minutes for the environment to build.

### 2. Setup in Codespace

Once the Codespace loads, open the terminal and run:

```bash
# Install dependencies
pnpm install

# Start Docker services (Codespaces has Docker)
docker-compose up -d postgres redis

# Wait for Postgres
docker-compose exec postgres pg_isready -U syntherium

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start all services
pnpm dev
```

### 3. Access Services

Codespaces will automatically forward ports. Click on the **PORTS** tab (next to TERMINAL) to see:
- Port 3001-3006 forwarded
- Click the globe icon to open in browser

---

## Common Issues & Fixes

### Issue: Docker not running

**Symptoms:**
```
Cannot connect to the Docker daemon
```

**Fix:**
- **Mac/Windows:** Start Docker Desktop
- **Linux:** `sudo systemctl start docker`

### Issue: Port already in use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3005
```

**Fix:**
```bash
# Find what's using the port
lsof -i :3005

# Kill it
kill -9 <PID>

# Or change the PORT in .env
```

### Issue: Database connection refused

**Symptoms:**
```
Error: Can't reach database server at `localhost:5432`
```

**Fix:**
```bash
# Check if Postgres is running
docker-compose ps

# Restart if needed
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Issue: Prisma client out of sync

**Symptoms:**
```
PrismaClientInitializationError: Prisma Client could not locate the Prisma binary
```

**Fix:**
```bash
pnpm db:generate
```

### Issue: pnpm not found

**Symptoms:**
```
bash: pnpm: command not found
```

**Fix:**
```bash
npm install -g pnpm
```

### Issue: Migration failed

**Symptoms:**
```
Error: P3005: Database schema is not empty
```

**Fix (⚠️ destructive - deletes all data):**
```bash
pnpm db:migrate reset
```

---

## Environment Variables

Create a `.env` file in the root (copy from `.env.example`):

```env
DATABASE_URL=postgresql://syntherium:password@localhost:5432/syntherium
REDIS_URL=redis://localhost:6379
FLUTTERWAVE_SECRET_HASH=your_secret_hash_here
NODE_ENV=development
```

---

## Next Steps

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for workflow guidelines
2. Check [docs/API.md](./API.md) for API contract details
3. Review [docs/REMAINING-WORK.md](./REMAINING-WORK.md) for current tasks
4. Join the team chat and introduce yourself!

---

## Useful Commands

```bash
# Run all tests
pnpm nx test

# Test single service
pnpm nx test orders-service

# Build all services
pnpm nx build

# Lint OpenAPI
pnpm api:lint

# Regenerate API types
pnpm api:sync

# Reset database (⚠️ deletes data)
pnpm db:migrate reset

# Stop all Docker containers
docker-compose down
```

---

## Questions?

Ask in the team chat or open a GitHub discussion!
