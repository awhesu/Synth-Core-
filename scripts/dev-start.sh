#!/bin/bash
# Syntherium Local Development Startup Script

set -e

echo "🚀 Starting Syntherium Platform..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Step 1: Start database
echo -e "${YELLOW}📦 Starting PostgreSQL database...${NC}"
docker-compose up -d postgres redis
echo -e "${GREEN}✅ Database started${NC}"
echo ""

# Wait for postgres to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
until docker-compose exec -T postgres pg_isready -U syntherium > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
echo ""

# Step 2: Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing dependencies...${NC}"
    pnpm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""
fi

# Step 3: Generate Prisma client
echo -e "${YELLOW}🔧 Generating Prisma client...${NC}"
pnpm db:generate
echo -e "${GREEN}✅ Prisma client generated${NC}"
echo ""

# Step 4: Run migrations
echo -e "${YELLOW}🗃️  Running database migrations...${NC}"
pnpm db:migrate:deploy 2>/dev/null || pnpm db:migrate
echo -e "${GREEN}✅ Migrations complete${NC}"
echo ""

# Step 5: Seed database
echo -e "${YELLOW}🌱 Seeding database with system accounts...${NC}"
pnpm db:seed || echo "Seed may have already run"
echo -e "${GREEN}✅ Database seeded${NC}"
echo ""

# Step 6: Generate API types
echo -e "${YELLOW}📝 Generating API types from OpenAPI...${NC}"
pnpm api:sync || echo "API sync skipped (install @redocly/cli and openapi-typescript first)"
echo ""

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Syntherium is ready!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "To start all services, run:"
echo "  pnpm dev"
echo ""
echo "Or start services individually:"
echo "  cd apps/orders-service && pnpm start:dev"
echo ""
echo "Database connection:"
echo "  postgresql://syntherium:syntherium_dev_123@localhost:5432/syntherium"
echo ""
echo "Service ports:"
echo "  API Gateway:      http://localhost:3000"
echo "  Intent Service:   http://localhost:3001"
echo "  Webhook Service:  http://localhost:3002"
echo "  Settlement:       http://localhost:3003"
echo "  Ledger Service:   http://localhost:3004"
echo "  Orders Service:   http://localhost:3005"
echo "  Ops Service:      http://localhost:3006"
echo ""
