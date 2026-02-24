# Demo Safeguards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce demo account limits (1 project, 2 runs per user) and fix the maxSteps input showing 0 when cleared, capping it at 30.

**Architecture:** Limit checks added to existing POST API routes using the `DEV_AUTH` env var as the dev/demo gate. No schema migration needed. maxSteps fix is a frontend-only change with a matching backend schema constraint.

**Tech Stack:** Next.js 15 API routes, Zod, Prisma, React state

---

### Task 1: Cap maxSteps in the shared RunConfig schema

**Files:**
- Modify: `packages/shared/src/types/run-config.ts`

**Step 1: Add `.max(30)` to the maxSteps field**

Open `packages/shared/src/types/run-config.ts`. Change:

```ts
maxSteps: z.number().int().positive().default(MAX_STEPS_DEFAULT),
```

to:

```ts
maxSteps: z.number().int().min(1).max(30).default(MAX_STEPS_DEFAULT),
```

**Step 2: Verify the build passes**

```bash
pnpm --filter @persona-lab/web build
```

Expected: build completes with no errors.

**Step 3: Commit**

```bash
git add packages/shared/src/types/run-config.ts
git commit -m "feat: cap maxSteps at 30 in RunConfig schema"
```

---

### Task 2: Fix maxSteps input bug and cap in the UI

**Files:**
- Modify: `apps/web/src/app/(app)/projects/[id]/runs/new/page.tsx`

**Background:** The bug is that `Number(e.target.value)` returns `0` when the input is cleared (empty string). The fix is to use `e.target.valueAsNumber` which returns `NaN` on empty, then clamp to a valid range.

**Step 1: Fix the onChange handler and lower max to 30**

In `new/page.tsx`, find the Max Steps `<Input>` block (around line 211) and replace it:

```tsx
<div className="space-y-1.5">
  <Label className="text-[13px] text-foreground">Max Steps</Label>
  <Input
    type="number"
    value={maxSteps}
    onChange={(e) => {
      const v = e.target.valueAsNumber;
      if (!isNaN(v)) setMaxSteps(Math.min(30, Math.max(1, v)));
    }}
    min={1}
    max={30}
    className="w-24"
  />
</div>
```

**Step 2: Verify the build passes**

```bash
pnpm --filter @persona-lab/web build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/projects/\[id\]/runs/new/page.tsx
git commit -m "fix: maxSteps input shows 0 when cleared, cap UI at 30"
```

---

### Task 3: Enforce 1-project limit on demo accounts

**Files:**
- Modify: `apps/web/src/app/api/projects/route.ts`

**Background:** When `process.env.DEV_AUTH !== "true"`, the user is a demo account. We check how many projects they already own before creating a new one.

**Step 1: Add the limit check to the POST handler**

In `apps/web/src/app/api/projects/route.ts`, update the POST handler. After the auth check and before `prisma.project.create`, add:

```ts
const devMode = process.env.DEV_AUTH === "true";
if (!devMode) {
  const projectCount = await prisma.project.count({
    where: { userId: session.user.id },
  });
  if (projectCount >= 1) {
    return NextResponse.json(
      { error: "Demo accounts are limited to 1 project." },
      { status: 403 }
    );
  }
}
```

The full updated POST handler should look like:

```ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devMode = process.env.DEV_AUTH === "true";
  if (!devMode) {
    const projectCount = await prisma.project.count({
      where: { userId: session.user.id },
    });
    if (projectCount >= 1) {
      return NextResponse.json(
        { error: "Demo accounts are limited to 1 project." },
        { status: 403 }
      );
    }
  }

  const body = await req.json();
  const input = CreateProjectInput.parse(body);

  const project = await prisma.project.create({
    data: { ...input, userId: session.user.id },
  });

  return NextResponse.json(project, { status: 201 });
}
```

**Step 2: Verify the build passes**

```bash
pnpm --filter @persona-lab/web build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/api/projects/route.ts
git commit -m "feat: limit demo accounts to 1 project"
```

---

### Task 4: Enforce 2-runs-per-user limit on demo accounts

**Files:**
- Modify: `apps/web/src/app/api/runs/route.ts`

**Background:** Count all runs owned by the user (across all flows/projects). If ≥2 and not dev mode, reject.

**Step 1: Add the limit check to the POST handler**

In `apps/web/src/app/api/runs/route.ts`, after the auth check and before parsing the request body, add:

```ts
const devMode = process.env.DEV_AUTH === "true";
if (!devMode) {
  const runCount = await prisma.run.count({
    where: { userId: session.user.id },
  });
  if (runCount >= 2) {
    return NextResponse.json(
      { error: "Demo accounts are limited to 2 runs." },
      { status: 403 }
    );
  }
}
```

**Step 2: Verify the build passes**

```bash
pnpm --filter @persona-lab/web build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/api/runs/route.ts
git commit -m "feat: limit demo accounts to 2 runs total"
```

---

### Task 5: Final verification

**Step 1: Full build check**

```bash
pnpm --filter @persona-lab/web build
```

Expected: clean build, no TypeScript errors.
