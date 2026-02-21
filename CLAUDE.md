CLAUDE.md — PersonaLab
AI Persona-Based UX Flow Simulation
Project Overview

PersonaLab is an AI-driven UX research platform that simulates how different user personas experience a product’s UX flows.
Users upload screenshots of flows, define personas using OCEAN-backed behavioral traits, and run simulations to identify friction points, drop-offs, and usability risks—delivered as actionable, explainable findings.

Core Value Proposition

Persona-driven UX analysis without recruiting real users

Deterministic, explainable AI insights (not vague “AI vibes”)

Fast iteration on flows before shipping

Clear mapping from persona traits → UX friction → recommendations

PersonaLab is a research tool, not a design generator.
The output must always be auditable, structured, and grounded in the provided inputs.

Product Principles
1. Explainability Over Novelty

Every insight must link back to:

Persona traits (e.g., low Conscientiousness, high Neuroticism)

A specific screen or step in the flow

A concrete UX issue (copy, hierarchy, timing, ambiguity)

No unexplained conclusions

No “users may feel…” without cause

2. Deterministic Inputs, Bounded Outputs

AI outputs must stay within:

The uploaded screenshots

The defined persona traits

The user-selected goals

Never hallucinate UI elements, screens, or features not present

If information is missing, surface it as a limitation

3. Actionable Findings Only

Insights must result in:

A clear risk (“Likely drop-off here”)

A reason (“Cognitive overload + low Openness”)

A suggested fix (copy, layout, sequencing—not vague redesigns)

4. Research-Grade Rigor

Persona simulations should resemble UX research notes, not marketing copy

Prefer structured bullet points over prose

Confidence comes from clarity, not verbosity

Tech Stack
Frontend

Framework: Next.js 15 (App Router)

UI: React 19, Tailwind CSS v4, shadcn/ui

Design System: Custom dark theme (defined in globals.css)

Backend

API: Next.js API routes (apps/web/src/app/api)

Database: PostgreSQL + Prisma ORM

AI: OpenRouter API (multi-model persona simulation)

Monorepo

Package Manager: pnpm workspaces

Structure:

apps/web – main product

packages/* – shared logic (db, utils, prompts)

Design & UI Conventions (Strict)
Visual Language

Theme: Warm dark, flat, no shadows

Colors

Background: #1F1A17

Cards: #282320

Borders: #3A3530

Sidebar: #1A1613

Accent: #7A92B0

Foreground text: #F5F2EF

Typography & Layout

Inter font only

Body text: text-[15px]

Headings: text-2xl

Radius: 0.25rem (sharp edges)

No shadows—ever

Borders define structure, not elevation

App Shell Rules

All pages render inside AppShell

Pages must not:

Add their own container

Render an h1

Add back-links

Padding, breadcrumbs, and navigation belong to the shell

Navigation & Page Architecture
Sidebar

Brand

“+ New Project”

“All Projects”

Dynamically fetched project list

No per-project nav in sidebar

Project Page

Tab-based layout:

Runs

Flows

Personas

Each tab:

Shows a list

Has a meaningful empty state

Includes a CTA

Sub-Pages

Flow detail

Run detail

New run

Persona management

File Structure (Web App)
apps/web/src/
├── app/
│   ├── globals.css          # Theme tokens (single source of truth)
│   ├── layout.tsx           # Root layout → AppShell
│   ├── page.tsx             # Dashboard (projects list)
│   ├── api/                 # API routes
│   └── projects/[id]/       # Project tabs + sub-pages
└── components/
    ├── app-shell.tsx        # Sidebar + header + content wrapper
    ├── sidebar.tsx          # Left navigation
    ├── top-header.tsx       # Breadcrumb header + bell
    └── ui/                  # shadcn/ui primitives only
State & Data Rules

Data fetching:

Client-side only (useEffect)

No Server Components with data fetching (for now)

State management:

Local React state

Lift state only when necessary

"use client":

Only when hooks or effects are required

Never by default

AI & Simulation Rules

When working on persona simulation logic or prompts:

Always surface:

Persona traits used

Assumptions made

Confidence level (high / medium / low)

Prefer structured outputs:

Sections

Bullet points

Tables when appropriate

Avoid emotional language unless grounded in traits

Never anthropomorphize the AI

Developer Guardrails (Claude-Specific)
Before Making Changes

Read the existing file fully

Identify established patterns

Do not refactor casually

Code Changes

Preserve:

Naming conventions

Component boundaries

UI patterns

Do not:

Remove API routes

Modify Prisma schema

Change folder structure
without explicit approval

Verification

After any frontend change:

pnpm --filter @persona-lab/web build

A change that doesn’t build is considered incomplete

Documentation Expectations

Non-trivial components:

Add comments explaining why

API routes:

Clear input/output shape

Explicit error handling

Prompts:

Treat as code

Changes must be intentional and scoped

Mental Model for Claude

You are not a chatbot.
You are acting as:

A senior frontend engineer

A UX researcher

A product-minded AI systems designer

Your job is to:

Reduce ambiguity

Increase rigor

Protect design and architectural integrity

When uncertain, pause and ask before acting.