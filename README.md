# PersonaLab

AI persona-based UX flow simulation tool. Upload screenshots of a UX flow, define personas with behavioral knobs, and simulate each persona walking through the flow. Get aggregated usability findings, friction points, and drop-off risks.

## Prerequisites

- Node.js >= 18
- pnpm
- Docker (for Postgres + Redis)

## Setup

```bash
# 1. Clone and install
pnpm install

# 2. Copy environment config
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY

# 3. Start infrastructure
docker compose up -d

# 4. Push database schema and generate Prisma client
pnpm setup

# 5. Build shared package
pnpm --filter @persona-lab/shared build
```

## Development

```bash
# Start Next.js dev server (port 3000)
pnpm dev:web

# Start BullMQ worker (in separate terminal)
pnpm dev:worker
```

## Usage

1. Create a project on the dashboard
2. Create a flow and upload screenshots of your UX flow
3. Define personas with behavioral knobs (patience, tech savviness, etc.)
4. Start a run — select flow + personas + model config
5. Watch the pipeline: PARSING → SIMULATING → AGGREGATING → COMPLETED
6. View the report with findings, severity scores, and per-persona breakdown

## Architecture

- **apps/web** — Next.js App Router (UI + API routes)
- **apps/worker** — BullMQ consumer (frame parsing, simulation, report aggregation)
- **packages/shared** — Shared TypeScript types and Zod schemas

## LLM Provider

Uses OpenRouter (OpenAI-compatible API) to support multiple models:
- `anthropic/claude-sonnet-4` (default)
- `openai/gpt-4o`
- `google/gemini-2.0-flash`
- Any other vision-capable model on OpenRouter

Set `OPENROUTER_API_KEY` in your `.env` file.

## Worker Pipeline

1. **parse_frame** — Extracts screen summary + UI elements from screenshots using vision
2. **simulate_episode** — Runs observe→reason→act loop for each persona
3. **aggregate_report** — Clusters issues, scores severity, generates findings
