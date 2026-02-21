# CLAUDE.md — PersonaLab

## Project overview

PersonaLab is an AI persona-based UX flow simulation tool. Users upload screenshots of their UX flows, define AI personas with OCEAN-backed behavioral traits, then run simulations to get friction/drop-off analysis and actionable findings.

## Tech stack

- **Monorepo**: pnpm workspaces (`apps/web`, `packages/*`)
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, shadcn/ui components
- **Backend**: Next.js API routes (in `apps/web/src/app/api/`)
- **Database**: PostgreSQL + Prisma ORM (schema in `packages/db/prisma/schema.prisma`)
- **AI**: OpenRouter API for multi-model persona simulation

## Key commands

```bash
pnpm dev:web          # Start dev server
pnpm --filter @persona-lab/web build   # Production build (typecheck included)
```

## Conventions

- **UI design language**: Warm dark theme inspired by Synthetic Users — flat, no shadows, borders delineate sections
- **Colors**: Background #1F1A17, cards #282320, borders #3a3530, sidebar #1a1613, dusty slate blue accent #7A92B0, foreground #f5f2ef
- **Layout**: All pages render inside `AppShell` (sidebar w-60 + breadcrumb header h-11 + content). Pages should NOT include their own container/h1/back-links — the shell provides padding (p-6) and the header shows breadcrumbs + bell
- **Sidebar**: Shows brand, + New Project, All Projects, then fetched project list. No per-project nav — project detail page uses tabs instead
- **Project page**: Tabs for Runs, Flows, Personas — each tab shows a list with empty state + CTA. Sub-pages exist for flow detail, run detail, new run, and persona management
- **Components**: shadcn/ui primitives live in `src/components/ui/`. App-level layout components (`app-shell.tsx`, `sidebar.tsx`, `top-header.tsx`) live in `src/components/`
- **Icons**: Use `lucide-react` for all icons
- **State**: Client-side fetch in `useEffect` — no server components with data fetching yet
- **Patterns**: Inter font, 0.25rem radius (sharp edges), filled-bg tabs, dashed borders for empty states, uppercase tracking-widest section labels, no shadows, text-[15px] for body text, text-2xl for headings
- **UI/UX guidelines**: See `.claude/uiux.md` for detailed design system rules, modern design principles, component patterns, and interaction standards

## File structure (web app)

```
apps/web/src/
├── app/
│   ├── globals.css          # Theme tokens
│   ├── layout.tsx           # Root layout (wraps in AppShell)
│   ├── page.tsx             # Dashboard (projects list)
│   ├── api/                 # API routes
│   └── projects/[id]/       # Project page (tabbed: runs/flows/personas) + sub-pages
└── components/
    ├── app-shell.tsx         # Sidebar + header + content wrapper
    ├── sidebar.tsx           # Left nav with project list (fetched)
    ├── top-header.tsx        # Slim breadcrumb header with bell icon
    └── ui/                   # shadcn/ui primitives
```

## Rules

- Always verify the build passes after changes: `pnpm --filter @persona-lab/web build`
- Do not remove or modify existing API routes or database schema without explicit approval
- Keep page components focused on content — layout chrome belongs in the shell
- Use `"use client"` only when needed (pages with state/effects, shell components with usePathname)
