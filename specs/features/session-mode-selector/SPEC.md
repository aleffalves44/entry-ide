# SPEC: session-mode-selector

## Context

The active-session UI exposes an ambiguous row of mixed affordances — "⟳ Loop" (`src/components/LoopBar.tsx`), "Builder"/provider action pills (`src/components/ProviderActionsBar.tsx`), a ">_ Terminal" mode toggle, and "Attach" (`src/components/ScopeBar.tsx`) — that conflates session *mode* with session *actions*. Users cannot tell what mode the session is in or how to change it.

Existing building blocks:
- `SessionCreatorMode` union `"agent" | "terminal" | "ssh"` and `SESSION_CREATOR_MODES` metadata at `src/components/SessionCreatorModeStep.tsx:23,35`.
- Mode state lives in `session.mode` (`src/state/SessionContext.tsx:248`); switching uses `convertSessionMode` (`src/state/SessionContext.tsx:2174`, claude-only guard at :2180).

## RIGID Requirements

R1. A single, visually unified mode selector MUST render in the session pane showing exactly three options: `● Agent`, `○ Terminal`, `○ SSH` — radio-group semantics, active mode filled/highlighted.

R2. Directly adjacent to the selector, a one-line description of the ACTIVE mode MUST render. Copy (verbatim):
   - Agent: "AI conversation with tools, diffs and approvals."
   - Terminal: "Classic shell — full PTY, any command."
   - SSH: "Remote shell on another machine."

R3. Selecting a different mode MUST trigger the existing mode-switch path (`convertSessionMode`) for `agent ⇄ terminal`. SSH: if native SSH sessions are not yet supported for conversion, the SSH option MUST render disabled with tooltip "Available for new sessions" — never silently no-op.

R4. When the claude-only guard blocks Agent mode (non-Claude provider), the Agent option MUST render disabled with a tooltip explaining why — not hidden.

R5. The ambiguous mixed bar MUST no longer present Loop / Builder / Terminal-toggle / Attach as a single undifferentiated row. Loop, Builder (provider actions) and Attach remain accessible but visually separated from the mode selector (actions ≠ mode). No functionality may be removed.

R6. Accessibility: the selector MUST use `role="radiogroup"` / `role="radio"` with `aria-checked`, keyboard navigable (arrow keys), and visible focus state.

R7. `npx tsc --noEmit` passes; existing tests pass; new component has at least one test covering: renders 3 options, active mode marked, disabled states per R3/R4.

## Acceptance Criteria (binary)

- AC1: Session pane shows ● Agent / ○ Terminal / ○ SSH selector with one-line description of active mode.
- AC2: Clicking Terminal on an agent-mode Claude session converts it; clicking Agent on a terminal-mode Claude session converts back.
- AC3: SSH option disabled with tooltip when conversion unsupported.
- AC4: No prior action (Loop, Builder, Attach) lost.
- AC5: tsc + test suite green.

## Out of scope

Native agent-over-SSH implementation (deferred to v1.1 per SessionCreatorModeStep). Session-creation flow redesign.
