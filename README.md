# Entry IDE

> AI-native terminal that understands your projects, predicts your commands, and executes autonomously.

Entry IDE is a desktop terminal emulator with deep AI integration for command-line workflows. It scans your projects to build context, suggests commands in real time, tracks errors and resolutions, and can execute tasks autonomously — all without leaving the terminal.

Fork of [Entry IDE](https://github.com/aleffalves44/entry-ide), rebranded and maintained independently. Licensed under the [Business Source License 1.1](LICENSE).

**Platforms:** macOS, Windows, Linux

---

## Features

### Agent mode for Claude
- **Real chat for Claude** — Claude sessions open in a rich chat interface, with thinking blocks, tool-call cards, and diff previews
- **Real images** — paste or drop images straight into the composer
- **Persistent conversations** — sessions resume across app restarts
- **Bring your own auth** — uses your existing `claude` CLI auth (Pro, Max, or API key)

### Terminal
- **Multi-session management** — create, switch, and organize parallel terminal sessions
- **Split panes** — horizontal and vertical splits with drag-and-drop reordering
- **WebGL-accelerated rendering** — fast terminal with web links and auto-fit
- **Execution timeline** — visual history of every command with exit codes and durations
- **Works with any CLI** — Aider, Codex, Gemini, Copilot, Kiro, plain shells all run in classic Terminal mode

### Git Integration
- **Built-in git panel** — staged, unstaged, and untracked files per project
- **Stage / unstage / commit / push / pull** — all from the sidebar
- **Inline diff viewer** — syntax-highlighted diffs for any changed file
- **Robust authentication** — SSH agent, SSH key files, Git Credential Manager, token-based auth

### AI Intelligence
- **Ghost-text suggestions** — real-time command completions from history and context
- **Prompt Composer** — natural-language instructions for autonomous task execution
- **Error pattern matching** — learns error fingerprints and auto-applies known resolutions
- **Stuck detection** — monitors hanging processes and offers interrupts

### Project Awareness
- **Automatic scanning** — detects languages, frameworks, architecture, and conventions
- **Context injection** — attaches project knowledge to AI agents via a token budget
- **Multi-project support** — attach multiple project contexts to a single session

### Productivity
- **Command Palette** — fuzzy search for any action
- **Cost Dashboard** — token usage and estimated costs per model and session
- **Memory & context pins** — persist important facts, files, and patterns across sessions
- **Plugin system** — extend the IDE with installable plugins

### Privacy
- **No telemetry** — Entry IDE collects nothing and sends nothing anywhere. AI requests go directly to your configured provider.

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org) | 18+ | Frontend build tooling |
| [Rust](https://rustup.rs) | 1.70+ | Backend compilation |
| [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) | — | System dependencies for Tauri |

#### Platform-Specific Dependencies

- **Linux:**
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (with "Desktop development with C++" workload) + [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Setup

```bash
git clone https://github.com/aleffalves44/entry-ide.git
cd entry-ide
npm install
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

### Development Commands

```bash
npm run tauri dev        # Full app with hot-reload
npx tsc --noEmit         # Type check
npm run test             # Frontend tests
cd src-tauri && cargo test  # Rust tests
```

---

## Architecture

Entry IDE is a [Tauri 2](https://tauri.app) application:

```
┌──────────────────────────────────┐
│         React Frontend           │
│     (TypeScript, Vite)           │
├──────────────────────────────────┤
│         Tauri IPC Bridge         │
├──────────────────────────────────┤
│          Rust Backend            │
│  (PTY, SQLite, Project Scanner)  │
└──────────────────────────────────┘
```

| Layer | Responsibility |
|-------|---------------|
| **Frontend** (`src/`) | UI components, terminal rendering, state management, suggestion engine |
| **IPC** | Tauri commands bridge React and Rust via typed async invocations |
| **Backend** (`src-tauri/`) | PTY session lifecycle, SQLite persistence, project scanning, context assembly |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the detailed technical overview.

---

## License

Source-available under the **[Business Source License 1.1](LICENSE)** (BSL 1.1), inherited from the upstream Entry IDE project. Each release converts to **Apache License 2.0** three years after publication.
