# ── Stage 1: Build ───────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy workspace config first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/

RUN pnpm install --frozen-lockfile

# Generate Prisma client
COPY apps/web/prisma/ apps/web/prisma/
RUN npx prisma@6 generate --schema=apps/web/prisma/schema.prisma

# Copy source and build
COPY packages/shared/src/ packages/shared/src/
COPY apps/web/src/ apps/web/src/

RUN pnpm --filter @persona-lab/shared build && \
    pnpm --filter @persona-lab/web build

# ── Stage 2: Runner ───────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output is self-contained (includes trimmed node_modules)
COPY --from=builder /build/apps/web/.next/standalone ./
COPY --from=builder /build/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /build/apps/web/prisma/ ./prisma/

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
