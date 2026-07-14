# docs/agents/agent-mode.md — Agent Mode

Domain guide for the Claude stream-json subprocess integration. Read [AGENTS.md](../../AGENTS.md) first. For the design rationale see [ADR 001](../adr/001-agent-mode.md).

## What Agent Mode Is

Agent mode spawns `claude` as a child process per session and communicates over a bidirectional NDJSON wire protocol (stream-json). The app renders Claude's typed events as React components instead of treating the terminal as a chat surface.

Command line used:
```
claude --print --output-format stream-json --input-format stream-json
```

## Rust Layer — `src-tauri/src/agent/`

| File | Purpose |
|---|---|
| `mod.rs` | Subprocess lifecycle (spawn, kill, restart), stdout/stderr NDJSON reader, stdin writer, Tauri event bridge |
| `prewarm.rs` | Pre-warms the bridge runtime on session creation so the first message does not block |
| `e2e_tests.rs` | Integration tests — require a live `claude` binary in PATH; all marked `#[ignore]` |

### Key types

- `AgentState` — Tauri-managed state; a `HashMap<session_id, AgentChild>` guarded by a `Mutex`
- `AgentChild` — owns the `Child` process handle and its stdin writer
- Line cap: 8 MiB per NDJSON line (prevents OOM from malformed payloads)

### IPC to frontend

The Rust layer deserializes each line from stdout and emits a Tauri event. The frontend listens per-session. Unknown event types are forwarded as-is (graceful fallback — log + continue).

## TypeScript Layer — `src/agent/`

### Event types (`types.ts`)

The `AgentEvent` discriminated union covers all event kinds:

| `type` field | Interface | Notes |
|---|---|---|
| `"system"` + `subtype:"init"` | `InitEvent` | First event; carries `tools[]`, `slash_commands[]`, `mcp_servers[]`, `model`, `permissionMode`, `memory_paths[]` |
| `"system"` (other subtypes) | `SystemEvent` | Generic fallback |
| `"assistant"` | `AssistantEvent` | Contains `message.content: ContentBlock[]` |
| `"user"` | `UserEvent` | Tool results; also echoed user messages |
| `"result"` | `ResultEvent` | Always last; `subtype: "success" | "error"` |
| `"rate_limit_event"` | `RateLimitEvent` | May appear at any position |
| `"parse_error"` | `ParseErrorEvent` | Internal; malformed line from subprocess |
| `"_entry_state_changed"` | `StateChangedEvent` | Internal envelope; emitted when model/permissionMode drift without a respawn |

Content block types within `AssistantEvent.message.content`:
- `TextBlockData` — rendered text
- `ThinkingBlockData` — extended thinking (collapsible)
- `ToolUseBlockData` — tool invocation with `id`, `name`, `input`
- `ToolResultBlockData` — pairs back to a `ToolUseBlockData` via `tool_use_id`
- `ImageBlockData` — base64 image (user attachments)

All type guards are exported from `types.ts` (`isInitEvent`, `isAssistantEvent`, etc.). Use them; do not match on `type` strings manually.

### Message store (`messageStore.ts`)

External store (not React state). Folds the event stream into a list of rendered messages. Consumed via `useSyncExternalStore`. Contains ~41 KB of reducer logic — do not add concerns unrelated to message-list folding here.

### Session store (`agentSessionStore.ts`)

External store for agent session lifecycle: spawn status, init state, prewarm state, working state. Also consumed via `useSyncExternalStore`.

### View root (`AgentSessionView.tsx`)

Pane root for agent sessions. Renders the message list (`blocks/`) and `SessionComposer.tsx`. Do not put agent business logic here — it belongs in the stores.

### Block components (`blocks/`)

One React component per content-block type. Receive a typed block datum as props; handle their own layout and CSS. Follow the existing naming pattern (`TextBlock.tsx`, `ToolUseBlock.tsx`, etc.).

## Sending User Input

`SessionComposer.tsx` calls a Tauri command (via `src/api/`) that writes a JSON `user` event to the subprocess's stdin:

```json
{ "type": "user", "message": { "role": "user", "content": [{ "type": "text", "text": "..." }] } }
```

Do not write to stdin by any other path.

## Init Event as Source of Truth

The `InitEvent` is authoritative for session capabilities. It replaces the old `claude --help` scraping approach:

- `slash_commands[]` — available slash commands
- `tools[]` — available tools
- `mcp_servers[]` — connected MCP servers
- `model` — active model
- `permissionMode` — active permission mode
- `memory_paths[]` — CLAUDE.md files loaded by the session

## Pre-warm Behaviour

On session creation (before the first user message), `prewarm.rs` starts the subprocess. This eliminates the ~5 s cold start from the user's first send. A "warming up Claude…" indicator is shown until the `init` event arrives.

## Mode Conversion

Converting a session from agent to terminal mode (or vice versa) discards the previous mode's history. Conversion is always explicit — triggered by a user action + confirmation dialog. Never convert automatically.

## Constraints

- `stream_event` (partial-message streaming) events are dropped by the reducer. Do not try to render them.
- Unknown event types must not crash the renderer — log and continue.
- The Rust agent module must never block the Tauri async runtime on stdin writes. Use `AsyncWriteExt`.
