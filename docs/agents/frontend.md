# docs/agents/frontend.md — Frontend (React/TypeScript)

Domain guide for the `src/` tree. Read [AGENTS.md](../../AGENTS.md) first.

## Directory Map

```
src/
  agent/              # Agent-mode view layer (NOT generic utilities)
  components/         # One file per component; colocated with nothing else
  hooks/              # Custom React hooks (use* prefix)
  i18n/               # In-repo i18n: en (source of truth) + pt-BR dicts, translate()
  plugins/            # Plugin runtime (PluginRuntime.ts, PluginLoader.ts, PluginAPI.ts)
  state/              # SessionContext.tsx + small external stores (loopStore, localeStore)
  styles/             # One .css file per component; filename matches component
  types/              # Shared TypeScript interfaces/types
  utils/              # Pure functions, no React imports
  terminal/           # xterm helpers (terminal mode only)
  windows/            # Tauri window management helpers
  App.tsx             # Root layout, provider tree
  main.tsx            # Vite entry point
```

## State Management

All session and UI state lives in `src/state/SessionContext.tsx`. It is a single React context wrapping the entire app. Do not create additional top-level contexts. Custom hooks in `src/hooks/` subscribe to context slices via `useContextState.ts`.

### Adding state
1. Add the field to the state type in `SessionContext.tsx`.
2. Add the reducer case if state is event-driven.
3. Expose a selector hook in `src/hooks/` — do not read context directly in leaf components.

## Component Conventions

- Functional components with hooks only — no class components.
- One component per file. Filename = component name (PascalCase).
- Co-locate sub-components only if they are never imported elsewhere; otherwise extract to `components/`.
- Props interfaces: inline when small, named `<Component>Props` when exported or large.
- No default exports in utility/hook files — use named exports.

## Internationalization (i18n)

- User-visible strings live in `src/i18n/en.ts` (default, source of truth) and
  `src/i18n/ptBR.ts`. `en`'s keys define `MessageKey`; `ptBR` is typed
  `Record<MessageKey, string>`, so a missing/extra key is a compile error.
- Components read copy via `const { t } = useTranslation()` and `t("key", { var })`.
  `{name}` placeholders interpolate. Never hard-code user-visible text; keep only
  technical values (command names, paths, acronyms, formatted numbers/units) inline.
- Locale state is `src/state/localeStore.ts` (a `useSyncExternalStore` source, not
  SessionContext) so it works in the standalone usage window too. Switch via
  `setLocale(...)` (Settings → General → Language); `initLocale()` loads the saved
  value at startup.

## CSS Rules

- Each component has exactly one CSS file: `src/styles/<ComponentName>.css`.
- Import it at the top of the component file: `import "../styles/ComponentName.css"`.
- No CSS-in-JS, no inline `style` attributes for layout/theming.
- CSS custom properties (variables) for all color and spacing tokens — do not hard-code hex values.

## Key Components

| Component | Purpose |
|---|---|
| `SplitPane.tsx` | Routes between agent and terminal render paths based on `session.mode` |
| `SessionComposer.tsx` | Message input surface for agent mode; writes JSON `user` events to subprocess stdin |
| `AgentSessionView.tsx` (`src/agent/`) | Full agent-mode pane: message list + composer |
| `TerminalPane.tsx` | xterm host for terminal mode |
| `SessionContext.tsx` | Global state container (not a component — it is the context provider) |
| `SessionList.tsx` | Left-panel session list |
| `Settings.tsx` | Full settings panel |

## TypeScript Rules

- Strict mode is on. `noImplicitAny`, `strictNullChecks`, etc.
- Never suppress with `// @ts-ignore` or `as any` — fix the type.
- Prefer `type` over `interface` for object shapes unless the type must be extended.
- Discriminated unions over optional fields for variant state.
- `unknown` for externally-typed data; narrow before use.

## Type Check and Lint

```bash
npx tsc --noEmit     # must pass clean
npx eslint .         # must pass clean (eslint-plugin-react-hooks enforced)
```

Both run in CI on every frontend change. Fix before pushing.
