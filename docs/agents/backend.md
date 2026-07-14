# docs/agents/backend.md — Rust/Tauri Backend

Domain guide for the `src-tauri/` tree. Read [AGENTS.md](../../AGENTS.md) first.

## Module Map

```
src-tauri/src/
  agent/          # Claude subprocess lifecycle, stream-json I/O
    mod.rs        # Spawn, event reading, stdin write
    prewarm.rs    # Pre-warm subprocess on session creation
    e2e_tests.rs  # Integration tests (require --ignored flag)
  pty/            # PTY management for terminal mode
    mod.rs        # PTY spawn, resize, I/O
    adapters.rs   # Platform adapters (Unix pty, Windows ConPTY)
    analyzer.rs   # Shell output analysis (prompt detection, etc.)
    commands.rs   # Tauri commands exposed to frontend
    models.rs     # PTY data types
    patterns.rs   # Shell pattern matchers
    shell_integration.rs  # Shell-specific hooks
    spawn.rs      # Process spawn helpers
  git/            # Git repo and worktree management
    mod.rs        # Core git operations (status, diff, log, stash)
    journal.rs    # Operation journal / audit log
    watcher.rs    # FS watcher for git state changes
    worktree.rs   # Worktree lifecycle
  process/        # OS process tracking
    mod.rs        # Process list, kill, state
  workspace/      # Workspace and project persistence
    mod.rs        # Workspace load/save
  plugins.rs      # Plugin host (loads/unloads plugin sandboxes)
  pipeline.rs     # Pipeline orchestration (workflow runner)
  platform.rs     # Platform-specific helpers (macOS/Linux/Windows)
  transcript.rs   # Session transcript persistence
  clipboard.rs    # Clipboard integration
  lib.rs          # All Tauri command registrations (#[tauri::command])
  main.rs         # Binary entry (thin — delegates to lib.rs)
```

## Adding a Tauri Command

1. Define the function in the relevant module with `#[tauri::command]`.
2. Register it in `lib.rs` inside `tauri::Builder::invoke_handler(tauri::generate_handler![...])`.
3. Add the TypeScript binding in the relevant `src/api/` file using `invoke<ReturnType>("command_name", { args })`.
4. Never call `invoke` directly from a component — wrap in a hook or api module.

## IPC Pattern

Frontend → Rust: `@tauri-apps/api invoke("command_name", payload)`.
Rust → Frontend: `app_handle.emit("event-name", payload)` listened via `listen("event-name", cb)` in frontend hooks.

Events are the preferred channel for streaming data (agent stdout, PTY output). Commands are for one-shot request/response.

## Rust Style

- `cargo fmt` and `cargo clippy -- -D warnings` must both pass.
- No `unwrap()` in production paths — use `?` with a meaningful error type or explicit `expect("reason")`.
- Keep modules focused. `lib.rs` is only a registration list; logic belongs in domain modules.
- Prefer `tokio` async for I/O; use `spawn_blocking` for CPU-heavy synchronous work.
- Serde aliases on event structs to survive upstream format changes gracefully.

## Testing

```bash
cd src-tauri && cargo test --lib         # All unit tests
cd src-tauri && cargo test --lib agent::e2e_tests:: -- --ignored --nocapture --test-threads 1
```

Agent e2e tests require a live `claude` binary in PATH and are marked `#[ignore]` so they do not run in standard CI.
