# AGENTS.md — Entry IDE

AI agent context root. Read this before touching any file in this repository.
For human contributors, see [CONTRIBUTING.md](CONTRIBUTING.md) and [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md).

## Repository at a Glance

| Property | Value |
|---|---|
| Product | Entry IDE — AI-native terminal emulator/IDE |
| Version | 1.3.2 |
| License | BSL 1.1 (Apache 2.0 after 3 years) |
| Stack | Tauri 2 + React 19 + Vite + TypeScript (strict) + Rust |
| Platforms | macOS, Windows, Linux |

## Repo Layout

```
entry-ide/
  src/                    # React/TypeScript frontend
    agent/                # Agent-mode store, types, view logic
    components/           # All UI components (one file per component)
    hooks/                # Custom React hooks
    plugins/              # Plugin runtime and builtin plugins
    state/                # SessionContext.tsx — central app state
    styles/               # Per-component CSS (no CSS-in-JS)
    types/                # Shared TypeScript types
    utils/                # Pure utility helpers
    terminal/             # xterm integration helpers
    App.tsx               # Root component + layout wiring
  src-tauri/              # Rust backend (Tauri 2)
    src/
      agent/              # Claude subprocess spawning, stream-json I/O
      pty/                # PTY management + xterm bridge
      git/                # Git repo/worktree management
      process/            # OS process tracking
      workspace/          # Workspace/project persistence
      plugins.rs          # Plugin host (Tauri-side)
      lib.rs              # Tauri command registry
  docs/
    adr/                  # Architecture Decision Records
    agents/               # THIS DIRECTORY — per-domain agent guides
  .github/workflows/      # CI (ci.yml, build.yml, release.yml)
```

## Two Session Modes — The Core Invariant

Every session has `mode: "terminal" | "agent"`. This determines the entire render path. **Never mix terminal and agent rendering code.**

| Mode | Transport | Rust module | React entry |
|---|---|---|---|
| `agent` | Claude CLI stream-json subprocess | `src-tauri/src/agent/` | `src/agent/AgentSessionView.tsx` |
| `terminal` | PTY via OS process | `src-tauri/src/pty/` | `src/components/TerminalPane.tsx` |

`SplitPane.tsx` routes between modes based on `session.mode`. See [ADR 001](docs/adr/001-agent-mode.md) for the full rationale.

## Agent-Mode Wire Protocol

Claude is spawned as:
```
claude --print --output-format stream-json --input-format stream-json
```

Events flow as NDJSON. Typed event kinds: `system/init`, `assistant`, `user`, `result`, tool hook events. The Rust layer (`src-tauri/src/agent/mod.rs`) reads stdout, deserializes events, and forwards them via Tauri events. The frontend reducer (`src/agent/messageStore.ts`) builds the message list. User input is written as JSON `user` events to the subprocess stdin via `src/components/SessionComposer.tsx`.

## Key State Files

- `src/state/SessionContext.tsx` — all session state (115 KB); the single source of truth for session list, active session, UI panel state
- `src/agent/agentSessionStore.ts` — agent-mode session lifecycle
- `src/agent/messageStore.ts` — per-session message list reducer

## Commands

```bash
npm run dev              # Vite dev server (frontend only)
npm run tauri dev        # Full Tauri app in dev mode
npm run test             # Vitest unit tests (src/**/*.test.ts[x])
npx tsc --noEmit         # TypeScript type check (strict)
cd src-tauri && cargo fmt --check   # Rust formatting check
cd src-tauri && cargo clippy -- -D warnings  # Rust linter
cd src-tauri && cargo test --lib    # Rust unit tests
npm run preflight        # Full local CI: tsc + eslint + vitest + cargo test + agent e2e
```

## Code Style — Hard Rules

- TypeScript: strict mode, no `any`, follow patterns in `src/`
- React: functional components + hooks only; state in `SessionContext`
- CSS: one `.css` file per component in `src/styles/`; no CSS-in-JS
- Rust: `cargo fmt` and `cargo clippy` must pass; follow existing module layout
- No new top-level dependencies without prior discussion

## Constraints for AI Agents

1. Do not clobber `CLAUDE.md` — it is the authoritative project briefing for Claude Code.
2. Do not commit or stage anything — leave changes unstaged.
3. Do not read `.env` files; reference `.env.example` if it exists.
4. Never invent architectural facts — cite evidence or write "Not applicable."
5. Bug fixes and doc changes need no prior approval; new features do.
6. When uncertain whether a change belongs to agent or terminal mode, read [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) §0 first.

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
