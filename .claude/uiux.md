# UI/UX Design Guidelines — PersonaLab

## Rule #1: Elevate the design. Preserve the state.

- Every UI change should make the product look and feel better than before — never lateral, never regressive
- Visual changes must never alter data flow, API calls, state variables, or URL structure unless explicitly asked
- When restyling a component, the user's experience of interactivity and data must remain identical

## Modern design principles

- **Density with clarity** — modern interfaces pack information tightly but use whitespace, weight, and size to maintain readability. Don't spread thin content across large empty areas
- **Subtle depth** — no shadows, but use border opacity, background opacity layers, and spacing to create visual planes (e.g., `bg-muted/40` hover layers, `border-border/60` for cards within cards)
- **Microinteractions** — `transition-colors duration-150` on every interactive element. Hover reveals, smooth state changes, opacity fades. Static UI feels dated
- **Purposeful motion** — transitions should feel instant but smooth. No bouncy animations, no delays. 150ms transitions, no easing beyond default
- **High contrast typography** — bright foreground (`text-foreground`) for primary content, clear muted levels for secondary. Modern UI is readable at a glance
- **Content-first layout** — minimize chrome. No decorative borders, no ornamental icons. Every pixel either informs or invites action
- **Tight alignment** — consistent left edges, flush baselines, even gutters. Misaligned elements immediately look amateur

## Hierarchy & layout

- Spacing creates hierarchy: `space-y-6` between sections, `space-y-4` within, `space-y-1.5` for fields
- Group with borders (`border-border/40` to `border-border`), not background shifts
- Section flow: heading -> description -> content -> action
- Let content breathe — whitespace over borders when in doubt

## Typography scale

- `text-2xl font-bold` — page headings
- `text-[15px]` — body text
- `text-sm text-muted-foreground` — secondary
- `text-xs text-muted-foreground` — metadata
- `text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50` — section labels
- Max 3 levels per view. Short copy: 1-3 word labels, 1-sentence descriptions

## Color discipline

- Primary accent for interactive/active states only — not decoration
- Opacity variants for subtlety: `border-border/40`, `text-muted-foreground/60`
- Destructive: `bg-destructive/10 text-destructive` — always confirm irreversible actions
- No new colors — use opacity within the existing palette

## Component patterns

- **Buttons**: outline + `border-primary/40 text-primary` for secondary, default for primary. Always icon + label with `gap-1.5`
- **Empty states**: dashed border, centered icon (h-11 w-11), title, description, action button
- **Lists**: `divide-y divide-border/40`, `hover:bg-muted/40 rounded`, `group-hover:text-primary`
- **Selection**: `border-primary bg-primary/5 text-primary` active, `border-border/60` inactive, Check icon
- **Tabs**: `bg-primary/10 text-primary` active, `border-b` divider
- **Status pills**: inline-flex, rounded, `px-2 py-0.5 text-xs font-medium`
- **Dialogs**: for creation/config. Inline editing for quick updates

## Interaction & feedback

- Every clickable element gets a hover state (`hover:bg-muted/40` minimum)
- `transition-colors duration-150` on all interactive elements
- Loading states for all async operations — never blank screens
- Inline actions hidden by default: `opacity-0 group-hover:opacity-100 transition-opacity`

## Preserving state (critical)

- Never discard user input or selections during UI changes
- Keep `useEffect` fetch patterns intact when restyling
- Don't convert client <-> server components without approval
- Same API calls, data shapes, URL structure — visual only unless told otherwise
- After changes, verify: hover, active, disabled, loading, empty, error states all work

## Hard rules

- No shadows — not on cards, modals, or dropdowns
- No corners beyond `rounded` (0.25rem) — no `rounded-lg`, `rounded-xl`, `rounded-full` on containers
- No gradients, glows, or decorative flourishes
- No emoji in the UI
- Don't add features/state/API calls when asked to improve design
- Don't wrap in extra divs — keep DOM shallow
- Don't introduce new fonts, icon libraries, or color tokens
