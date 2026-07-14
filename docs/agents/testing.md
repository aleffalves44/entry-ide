# docs/agents/testing.md — Testing

Domain guide for the test suite. Read [AGENTS.md](../../AGENTS.md) first.

## Test Commands

```bash
npm run test                     # Vitest unit tests (all *.test.ts[x] under src/)
npx tsc --noEmit                 # TypeScript type check — must pass before any commit
npx eslint .                     # ESLint; react-hooks plugin enforced
npm run preflight                # Full local CI: tsc + eslint + vitest + cargo test + agent e2e

cd src-tauri && cargo test --lib                          # Rust unit tests
cd src-tauri && cargo test --lib agent::e2e_tests:: \
  -- --ignored --nocapture --test-threads 1              # Agent e2e (requires live claude binary)
```

CI runs `npx vitest run` (not `npm run test`) on every PR touching `src/`.

## Frontend Tests — Vitest

Location: `src/__tests__/`

Convention: one test file per feature area or bug fix. File names are descriptive and kebab-cased.

```
src/__tests__/
  agent-message-store.test.ts        # messageStore reducer
  agent-session-store.test.ts        # agentSessionStore lifecycle
  session-mode.test.ts               # mode routing, SplitPane behaviour
  terminal-core.test.ts              # PTY helpers
  context-injection.test.ts          # context assembly
  worktree-safety.test.ts            # git worktree invariants
  ... (200+ files)
```

### Setup file

`src/__tests__/setup.ts` — minimal global setup. Runs before every test file.

### Mocking pattern

Tauri APIs (`@tauri-apps/api`), native modules, and utility helpers that touch the filesystem or IPC are mocked with `vi.mock(...)`. The mock factory should return the minimum shape needed for the test — do not over-specify.

Example:
```typescript
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
```

Do not mock implementation details of the module under test — mock its dependencies.

### Testing agent stores

`messageStore` and `agentSessionStore` are external stores. Tests drive them by calling their dispatch functions directly, then assert on `getSnapshot()`. Example pattern:

```typescript
import { dispatch, getSnapshot } from "../../agent/messageStore";

beforeEach(() => dispatch({ type: "RESET" }));

it("folds assistant event into message list", () => {
  dispatch({ type: "AGENT_EVENT", event: assistantEvent });
  expect(getSnapshot().messages).toHaveLength(1);
});
```

### React component tests

Use `@testing-library/react` with `renderWithProviders` (defined in `src/__tests__/` — grep for it). Always wrap renders in the session context provider. Query by accessible role or test-id; avoid querying by CSS class.

### Regression tests

For every bug fix, add a test file named `<area>-bugs.test.ts` or a case in an existing bugs file. The test must fail on the old code and pass on the fix. This is non-negotiable.

## Rust Tests

`src-tauri/src/agent/` contains `e2e_tests.rs` — full integration tests that spawn a real `claude` subprocess. These are:
- Marked `#[ignore]` so they do not run in standard `cargo test --lib`
- Require a live `claude` binary in `PATH`
- Run single-threaded (`--test-threads 1`) to avoid subprocess conflicts

Unit tests in other Rust modules (`mod tests { ... }`) run normally with `cargo test --lib`.

## CI Gates

Every PR against `main` must pass:
1. `npx tsc --noEmit` (TypeScript — strict)
2. `npx vitest run` (frontend unit tests)
3. `cd src-tauri && cargo fmt --check`
4. `cd src-tauri && cargo clippy -- -D warnings`

The agent e2e tests and Playwright e2e tests do not run in standard CI — run them locally when changing agent mode or UI flows.

## What NOT to Test

- Internal implementation details that are not observable through the public API of a module
- xterm.js rendering output (it owns its canvas; test at the pool API level)
- Tauri command serialisation (trust the type system + integration tests)
