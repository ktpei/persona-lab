# PersonaLab — Project Documentation

## What is PersonaLab?

PersonaLab is an AI-powered UX testing tool that simulates diverse user personas navigating through your app's UI flows. Instead of recruiting real users for initial usability testing, you can:

1. **Upload screenshots** of your UX flow (e.g., a checkout process)
2. **Define AI personas** with behavioral traits (patience, tech-savviness, goal orientation, etc.)
3. **Run simulations** where each persona walks through your flow
4. **Get a report** with friction points, drop-off risks, and actionable recommendations

## Architecture

```
persona-lab/
├── apps/
│   └── web/                    # Next.js 15 full-stack app
│       ├── src/app/            # Pages + API routes (App Router)
│       └── src/components/     # UI components
├── packages/
│   └── db/                     # Prisma schema + client
├── docker-compose.yml          # PostgreSQL
└── pnpm-workspace.yaml         # Monorepo config
```

### Frontend

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS v4 with DashStack design language
- **Components**: shadcn/ui primitives + custom layout shell
- **Icons**: lucide-react

### Backend

- **API**: Next.js Route Handlers (`/api/*`)
- **Database**: PostgreSQL via Prisma ORM
- **AI**: OpenRouter API for multi-model access (Claude, GPT-4o, etc.)

## Data model

| Entity | Description |
|--------|-------------|
| **Project** | Top-level container for a UX testing initiative |
| **Flow** | A sequence of UI screenshots representing a user journey |
| **Frame** | A single screenshot within a flow, with parsed summary |
| **Persona** | An AI persona with behavioral knobs (patience, tech-savviness, etc.) |
| **Run** | A simulation execution pairing a flow with one or more personas |
| **Episode** | One persona's walkthrough of a flow within a run |
| **Step** | A single action/observation within an episode |
| **Finding** | An aggregated UX issue discovered across episodes |

## UI Design Language: DashStack

The UI follows the DashStack dashboard pattern:

- **Sidebar** (w-64): White background, blue (#4880FF) active pill, brand logo top-left
- **Top header**: Sticky white bar with page title, search, notifications, user avatar
- **Canvas**: Light gray (#F5F6FA) background so white cards pop
- **Cards**: White with 0.75rem radius, subtle shadows on hover
- **Stat cards**: Colored icon boxes (blue, green, purple, orange) with value + label
- **Typography**: Inter font family, clean weight hierarchy (400/500/600/700)
- **Accent color**: #4880FF blue used for active states, primary buttons, focus rings

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — project list with summary stat cards |
| `/projects/[id]` | Project overview — flows, personas, runs sections |
| `/projects/[id]/flows/[flowId]` | Flow detail — upload frames, view filmstrip |
| `/projects/[id]/personas` | Persona management — create with knob sliders |
| `/projects/[id]/runs/new` | New run — select flow, personas, configure model |
| `/projects/[id]/runs/[runId]` | Run detail — episodes, summary stats, findings, per-persona breakdown |

## Development

```bash
# Prerequisites
docker compose up -d    # Start PostgreSQL

# Install & setup
pnpm install
pnpm --filter @persona-lab/db db:push   # Push schema to DB

# Development
pnpm dev:web            # http://localhost:3000

# Build verification
pnpm --filter @persona-lab/web build
```

## Environment variables

See `apps/web/.env` for required configuration:
- `DATABASE_URL` — PostgreSQL connection string
- `OPENROUTER_API_KEY` — API key for AI model access
