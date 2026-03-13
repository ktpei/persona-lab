# PersonaLab

AI-powered UX testing tool that simulates real user personas navigating your product to surface friction points, drop-off risks, and actionable findings before real users ever see them.

Check out the project at [Devpost](https://devpost.com/software/personalab-43h7mk).

## How It Works

1. Create a project and define a UX flow — upload screenshots or point it at a live URL
2. Build personas from 45+ behavioral archetypes backed by OCEAN personality traits
3. Run a simulation — AI agents walk through your flow as each persona, scoring friction at every step
4. Review severity-ranked findings, per-screen analysis, and AI-generated fix recommendations
5. Go deeper — chat with personas, run voice interviews, or host a focus group

## Two Modes

**Screenshot Mode** — Upload static screenshots. Personas analyze each screen and decide whether to advance, hesitate, or abandon.

**Agent Mode** — Point at a live URL. Personas navigate real websites via Playwright — clicking, typing, scrolling — each in an isolated browser instance.

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4, shadcn/ui
- **Backend**: Next.js API Routes, PostgreSQL + Prisma, BullMQ (Redis)
- **AI**: OpenRouter (Gemini, Claude, Kimi — any vision-capable model)
- **Browser**: Playwright (local or Docker-isolated)
- **Voice**: 11Labs Real-Time Voice Agent

## Setup

```bash
pnpm install
cp .env.example .env          # Add OPENROUTER_API_KEY at minimum
docker compose up -d           # PostgreSQL + Redis
pnpm setup                     # DB schema + Prisma client
pnpm --filter @persona-lab/shared build
```

## Development

```bash
pnpm dev:web        # Next.js on port 3000
pnpm dev:worker     # BullMQ simulation worker
```

## Project Structure

```
apps/web/        — Next.js app (UI + API routes)
apps/worker/     — Simulation engine + browser automation
packages/shared/ — Shared types, persona system, constants
```

## Key Features

- **Live simulation view** with real-time screenshot previews and agent thought bubbles
- **Run cancellation** — abort mid-run; stuck agents auto-terminate after 3 repeated actions
- **Persona chat & voice interviews** — text or 11Labs voice calls with any persona post-run
- **Focus groups** — multi-persona discussions about findings
- **AI fix suggestions** per finding
- **45+ persona archetypes** across e-commerce, SaaS, finance, travel, healthcare, and more
