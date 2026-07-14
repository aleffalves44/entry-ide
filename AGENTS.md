# AGENTS.md — Entry IDE

Repository-specific knowledge for agents working in this codebase.

## Design system (the most important context)

Entry ships a mature, token-based design system documented in
`docs/design-system/00-principles.md` … `09-migration.md`. The system is
**aspirational unless enforced** — component CSS historically violated
its own principles. As of this writing the major debt is cleared and a
linter guards regressions.

### Rules that are ENFORCED (do not break)

- **`npm run lint:tokens`** fails the build on: raw `rgba(0,0,0,…)` box
  shadows, manual `cubic-bezier(…)`, raw durations in
  `transition:`/`animation:` (non-loop), and literal `z-index: <number>`.
  Run it before pushing CSS changes. It runs in `preflight` too.
- Use the elevation tokens `--shadow-1..4` (1=cards, 2=dropdowns,
  3=popovers, 4=dialogs). The `--shadow-tint` per-theme token makes them
  warm on Linen/Atrium and cool on dark themes — never paste `#000`.
- Use easing tokens `--ease-out-expo/-soft/spring/standard` and duration
  tokens `--dur-tap/quick/base/slow`. The mapping table is in
  `docs/design-system/05-motion.md`.
- Use the z-index scale in `tokens.css`: `--z-base`, `--z-raised`,
  `--z-overlay`, `--z-popover`, `--z-modal`, `--z-picker`, `--z-toast`,
  `--z-drag`. Relative order: base < raised < overlay < popover < modal
  < picker < toast < drag.
- Loop animations (shimmer/sweep/pulse/drift) keep their content-timing
  literals (e.g. `1.6s`) — those are NOT motion-of-UI and must not be
  tokenized. The linter exempts lines containing `infinite`.
- Themes override **tokens**, never patch components (P4). If a theme
  needs per-component CSS, a token is missing — extract it.

### Adding a theme

Write an `html[data-theme="…"]` block in `themes.css` that overrides the
surface/ink/voice/shadow-tint tokens, and pick one archetype by setting
the `--tool-card-*` / `--turn-separator` tokens. No component code should
care which theme is active.

## Commands

- `npm run dev` — Vite dev server
- `npm run tauri dev` — full Tauri app
- `npm test` — vitest (3624 tests; CSS/z-index changes are covered by
  `agent-timeline-style.test.ts`, `toast-positioning.test.ts`, etc.)
- `npm run lint:tokens` — token-discipline linter (CSS regressions)
- `npm run lint:tsc` / `npm run lint` — type check / eslint
- `npm run preflight` — full gate: tsc + eslint + lint:tokens + tests +
  cargo lib tests + agent e2e

## Architecture

See `CLAUDE.md` and `ARCHITECTURE.md`. Two session modes: `agent`
(Claude, stream-json subprocess) and `terminal` (PTY + xterm). State
lives in `src/state/SessionContext.tsx`. `SplitPane.tsx` routes by mode.

## Domain Guides

Detailed context for specific domains lives under `docs/agents/`:

- [frontend.md](docs/agents/frontend.md) — React component patterns, state, CSS
- [backend.md](docs/agents/backend.md) — Rust/Tauri modules, commands, IPC
- [agent-mode.md](docs/agents/agent-mode.md) — stream-json protocol, message store, Claude subprocess
- [terminal-mode.md](docs/agents/terminal-mode.md) — PTY, xterm, shell integration
- [testing.md](docs/agents/testing.md) — vitest setup, test conventions, Rust test layout
- [plugins.md](docs/agents/plugins.md) — plugin runtime, builtin plugins, plugin API

## ADRs

| ID | Title | Status |
|---|---|---|
| [001](docs/adr/001-agent-mode.md) | Agent mode for Claude | Accepted |
| [002](docs/adr/002-bridge-runtime-tarball.md) | Bridge runtime as a first-launch tarball | Proposed |

Full records: `docs/adr/`.
