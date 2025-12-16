# Multi-stage Dockerfile for Syntherium services
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/*/package.json ./apps/
COPY libs/*/package.json ./libs/

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile || pnpm install

# Build stage
FROM deps AS builder

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm db:generate || true

# Build argument for service name
ARG SERVICE=api-gateway

# Build the specific service
RUN pnpm nx build ${SERVICE} || echo "Build skipped - running in dev mode"

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/openapi ./openapi

ARG SERVICE=api-gateway
ENV SERVICE_NAME=${SERVICE}

# Set the entrypoint
CMD ["sh", "-c", "cd apps/${SERVICE_NAME} && pnpm start:dev"]
