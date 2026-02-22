# ── Stage 1: Install dependencies and build ──────────────────────────
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy workspace config and lockfile first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# Copy package.json files for all needed packages
COPY apps/worker/package.json apps/worker/tsconfig.json apps/worker/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/

# Copy Prisma schema (lives in apps/web/prisma/)
COPY apps/web/prisma/ apps/web/prisma/
# Minimal web package.json so pnpm resolves the workspace reference
COPY apps/web/package.json apps/web/

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Generate Prisma client from the web app's schema (pin to v6 to match project)
RUN npx prisma@6 generate --schema=apps/web/prisma/schema.prisma

# Copy source code and build
COPY packages/shared/src/ packages/shared/src/
COPY apps/worker/src/ apps/worker/src/

RUN pnpm --filter @persona-lab/shared build && \
    pnpm --filter @persona-lab/worker build

# ── Stage 2: Production image ────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy built packages with their package.json
COPY --from=builder /build/packages/shared/package.json packages/shared/package.json
COPY --from=builder /build/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /build/apps/worker/package.json apps/worker/package.json
COPY --from=builder /build/apps/worker/dist/ apps/worker/dist/

# Copy Prisma schema + generated client
COPY --from=builder /build/apps/web/prisma/ apps/web/prisma/
COPY --from=builder /build/apps/web/package.json apps/web/package.json
COPY --from=builder /build/node_modules/.pnpm/@prisma+client*/node_modules/.prisma/ node_modules/.prisma/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod && \
    npx prisma@6 generate --schema=apps/web/prisma/schema.prisma

ENV NODE_ENV=production
ENV DOTENV_PATH=/app/.env

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
