# docs/agents/terminal-mode.md — Terminal Mode

Domain guide for the PTY + xterm integration. Read [AGENTS.md](../../AGENTS.md) first.

## What Terminal Mode Is

Terminal mode hosts a classic pseudo-terminal (PTY) subprocess inside an xterm.js instance. It works with any shell or CLI tool. No composer, no chat protocol — the app gets out of the program's way.

Sessions restored from pre-1.0.0 workspaces (where `mode` is absent) default to terminal mode.

## Rust Layer — `src-tauri/src/pty/`

| File | Purpose |
|---|---|
| `mod.rs` | Core PTY management: spawn, resize, I/O, session phase state machine |
| `adapters.rs` | Platform adapters (Unix PTY via `portable-pty`, Windows ConPTY) |
| `analyzer.rs` | Shell output analysis: prompt detection, phase transitions, provider identification |
| `commands.rs` | Tauri commands exposed to frontend (`create_pty_session`, `write_to_pty`, `resize_pty`, etc.) |
| `models.rs` | PTY data types |
| `patterns.rs` | Regex/string patterns for shell detection |
| `shell_integration.rs` | Shell-specific hooks (zsh/bash/fish) |
| `spawn.rs` | OS process spawn helpers |

### Session Phase State Machine

```
Creating → Initializing → ShellReady → LaunchingAgent → Idle ↔ Busy ↔ NeedsInput → Closing → Destroyed
```

Defined in `src-tauri/src/pty/mod.rs`. Phase transitions are driven by the `OutputAnalyzer`.

### Output Analyzer

`OutputAnalyzer` processes raw PTY output per session:
1. Strips ANSI escape sequences
2. Routes output through the `ProviderAdapter` registry
3. Detects the active AI provider running inside the terminal
4. Tracks token usage, determines phase transitions

### Provider Adapters

`ProviderAdapter` trait — each adapter knows how to:
- Detect agent startup (parse "Claude Code … started" style banners)
- Parse token usage from terminal output
- Identify tool calls (best-effort TUI parsing)
- Recognise prompts / NeedsInput state

Providers supported: Claude Code (terminal/TUI mode), Aider, Gemini CLI, Codex. This is the legacy path — Agent mode (not ProviderAdapter) is the authoritative integration for Claude.

## Frontend Layer

### `TerminalPane.tsx`

xterm host component. Receives a `sessionId` prop, attaches the corresponding `TerminalPool` entry, handles resize events. Has no awareness of agent-mode data structures.

### `TerminalPool.ts` (`src/terminal/TerminalPool.ts`)

Module-level singleton. Manages xterm.js instances, lifecycle, and PTY I/O bridging.

Key functions:
- `createTerminal(sessionId, color)` — create + configure xterm instance
- `attach(sessionId, container)` / `detach(sessionId)` — DOM mount/unmount
- `destroy(sessionId)` — full teardown
- `focusTerminal(sessionId)`
- `writeScrollback(sessionId, content)` — restore terminal content

Do not construct `Terminal` instances outside the pool.

### `SplitPane.tsx` routing

`SplitPane.tsx` reads `session.mode`. When `mode === "terminal"` it renders `TerminalPane`. When `mode === "agent"` it renders `AgentSessionView`. This is the only routing point — never check `session.mode` for this purpose elsewhere.

### Intelligence Engine (`src/terminal/intelligence/`)

Client-side suggestion system for terminal mode:
- `shellEnvironment.ts` — detects shell type and plugins (zsh/bash/fish)
- `contextAnalyzer.ts` — project context detection for suggestion relevance
- `suggestionEngine.ts` — scoring algorithm; target < 5 ms/invocation
- `commandIndex.ts` — static index of common commands
- `historyProvider.ts` — shell history + per-session history matching
- `SuggestionOverlay.tsx` — dropdown suggestion panel

Ghost text (inline suggestions): managed by the pool, rendered as a semi-transparent overlay. Tab accepts.

### Intent Commands (`src/terminal/intentCommands.ts`)

Colon-prefixed shortcuts (`:test`, `:diff`) resolved to actual shell commands before PTY write.

## Constraints

- Terminal mode has no JSON protocol and no composer. Never send JSON user events to a PTY session.
- Ghost text state and suggestion state belong in the TerminalPool entry, not in React state.
- The `OutputAnalyzer` and `ProviderAdapter` path is a legacy compatibility layer. Do not add Claude-specific features here; they belong in agent mode.
