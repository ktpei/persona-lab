# Auth Design — PersonaLab
Date: 2026-02-24

## Overview

Add multi-user authentication to PersonaLab using NextAuth v5 (Auth.js) with Google and GitHub OAuth providers. Each user owns their own projects, personas, and runs. A dev mode allows instant sign-in without OAuth for local development.

## Auth Library

**NextAuth v5 + Prisma adapter.** Sessions and user records stored in Postgres via the existing Prisma setup. No external auth service required.

## Schema Changes

Add the four NextAuth-required models:
- `User` — id, name, email, image, createdAt
- `Account` — OAuth account linkage (provider, providerAccountId, tokens)
- `Session` — active session records
- `VerificationToken` — email verification (required by adapter even if unused)

Add `userId` FK to user-owned models:
- `Project.userId` (required, cascades on delete)
- `Persona.userId` (required, cascades on delete)
- `Run.userId` (required, cascades on delete)

`Flow` is owned transitively through `Project` — no direct `userId` needed.

**Migration strategy:** `prisma migrate reset` — wipe existing data and apply fresh schema.

## Dev Mode

Controlled by `.env` variables:
```
DEV_AUTH=true
DEV_ADMIN_EMAIL=admin@dev.local
DEV_ADMIN_NAME=Dev Admin
```

When `DEV_AUTH=true`:
- A NextAuth `Credentials` provider is registered alongside (or instead of) OAuth providers
- The `/login` page shows a single "Continue as Dev Admin" button
- Clicking it signs in immediately as the dev admin user (upserted on first use)
- No real credentials or OAuth flow required
- Middleware still enforces session — just trivially easy to get one

## Route Protection

`middleware.ts` at the repo root intercepts all requests. Unauthenticated users are redirected to `/login`. Public paths: `/login`, `/api/auth/*`.

## API Scoping

All user-owned API routes extract `userId` from the NextAuth session and scope queries:
- `GET /api/projects` → `findMany({ where: { userId } })`
- `POST /api/projects` → `create({ data: { ...input, userId } })`
- `DELETE /api/projects/[id]` → verify ownership before delete
- Same pattern for `/api/personas` and `/api/runs`
- Routes for sub-resources (flows, frames, episodes, findings) verify ownership via their parent's `userId`

## UI Changes

- New `/login` page with Google + GitHub OAuth buttons (or "Continue as Dev Admin" in dev mode)
- Sign-out button in `top-header.tsx`
- User avatar/name in sidebar or header from session
- Redirect to `/login` on sign-out

## Environment Variables to Add

```
# OAuth providers (production)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_SECRET=   # random secret for JWT signing

# Dev mode
DEV_AUTH=false
DEV_ADMIN_EMAIL=admin@dev.local
DEV_ADMIN_NAME=Dev Admin
```
