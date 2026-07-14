# SPEC: agent-error-actions

## Context

When the Claude agent subprocess fails, the agent pane shows passive text with a single recovery affordance. Existing surfaces (all in `src/agent/AgentSessionView.tsx`):
- `selectFatalError` (:315) → `div.agent-result-error` banner for SDK `is_error` results.
- `exitInfo` + `shouldShowExitNotice` (:337, :879) → `div.agent-exit-notice` for subprocess exits, with `classifyExit` (:890) labels (no-conversation / signal / crash / exit) and a raw-stderr `<details>` (:354).
- Only action today: "Start fresh from here" (:344).

Hooks available:
- Mode switch: `convertSessionMode` in `src/state/SessionContext.tsx:2174`.
- AI setup screen: Settings `ai-agent` tab (`src/components/Settings.tsx:792`).

## RIGID Requirements

R1. Every agent failure surface (`agent-result-error` banner AND `agent-exit-notice`) MUST render three action buttons alongside the failure text — never failure text alone:
   - **Retry** — re-attempts the agent session (reuse/extend the existing "Start fresh from here" path for exit notices; for result errors, resend/restart as appropriate to the existing recovery path).
   - **Switch to Terminal** — converts the session to terminal mode via the existing `convertSessionMode` path (including its existing confirmation flow, if any).
   - **Open AI setup** — opens Settings directly on the `ai-agent` tab.

R2. The failure message MUST remain visible (classification label + stderr details preserved). Actions are additive; no existing diagnostic info may be removed.

R3. "Open AI setup" MUST land on the `ai-agent` tab specifically — not the Settings default tab. If Settings currently lacks an "open at tab" entry point, add one (prop/param), without changing default behavior for other callers.

R4. Buttons MUST be keyboard-accessible real `<button>` elements with visible focus states, styled per existing per-component CSS convention (`src/styles/`).

R5. When session conversion is not possible (e.g., guard in `convertSessionMode`), "Switch to Terminal" MUST render disabled with a tooltip stating why — never fail silently.

R6. `npx tsc --noEmit` introduces zero net-new errors on changed files; existing tests pass; new/updated tests cover: all three actions render on both failure surfaces, Retry triggers recovery handler, Switch to Terminal triggers conversion request, Open AI setup opens Settings at `ai-agent`.

## Acceptance Criteria (binary)

- AC1: Agent failure (both surfaces) shows Retry + Switch to Terminal + Open AI setup.
- AC2: No failure state renders text-only.
- AC3: Open AI setup lands on Settings `ai-agent` tab.
- AC4: Existing diagnostics (classification, stderr) unchanged.
- AC5: tsc net-zero + test suite green.

## Out of scope

Automatic failure remediation, error telemetry, redesign of exit classification.
