# Demo Safeguards Design — 2026-02-24

## Problem

Demo (non-dev) users can create unlimited projects and runs, risking credit abuse.
The maxSteps input always shows 0 when cleared due to `Number("") === 0`.

## Solution

### 1. Demo account limits

**Signal**: `process.env.DEV_AUTH === "true"` = dev mode (no limits). All other users are demo accounts.

**Limits**:
- Max 1 project per user
- Max 2 runs per user (total, across all projects)

**Enforcement**:
- `POST /api/projects` — count user's projects; if ≥1, return 403
- `POST /api/runs` — count user's runs; if ≥2, return 403

### 2. maxSteps input fix + cap

**Bug**: `Number(e.target.value)` returns `0` on empty string.

**Fix**: Use `e.target.valueAsNumber` (returns `NaN` on empty) with a clamp helper.

**Cap**: Lower from 100 → 30 in:
- UI: `max={30}`
- Backend: `RunConfig` zod schema `.max(30)`

## Files changed

- `apps/web/src/app/api/projects/route.ts` — add limit check to POST
- `apps/web/src/app/api/runs/route.ts` — add limit check to POST
- `packages/shared/src/types/run-config.ts` — add `.max(30)` to maxSteps
- `apps/web/src/app/(app)/projects/[id]/runs/new/page.tsx` — fix input bug, change max to 30
