# SPEC: pending-decision-notification

## Metadata

| Field | Value |
|---|---|
| slug | pending-decision-notification |
| tier | light |
| type | bug-fix |
| scope | agent-mode notification |
| branch | fix/pending-decision-notification |

## Context

When the agent session needs user input (tool permission, AskUserQuestion, or plan approval), the
only notification path in the app fires on `busy → idle` transitions after ≥30 s (`notifyLongRunningDone`).
A pending decision never triggers an OS notification, so users who switch to another app have no
signal that Claude is waiting — the session stalls silently until they return.

Root cause: `pendingPermRequest` is captured in `AgentSessionStore` (line 138-143) and propagated
to subscribers via `notify()`, but neither the store nor any observer calls `sendNotification` at
that point. The window-hidden gate (`document.hidden`) used by the long-running path is absent from
this code path entirely.

## RIGID

### RF-FIX-01 — Emit OS notification on pending decision when window is hidden

GIVEN an agent session has an active `pendingPermRequest` (type `_entry_perm_request`)
AND `document.hidden` is `true` (window not focused)
AND the request id has not already been notified this session
AND `permissionMode` is NOT `"bypassPermissions"` (bypass sessions auto-resolve; no user action needed)
WHEN the perm-request envelope is processed by `AgentSessionStore`
THEN exactly one OS notification is dispatched with title `"Decision needed"` and body
`"<session-label>" — Claude is waiting for your input on: <tool>`

AC-1: notification fires at most once per unique request `id` (no re-notify on subscriber
re-render or store re-subscribe).

AC-2: notification is NOT fired when `document.hidden` is `false` (window focused).

AC-3: clearing `pendingPermRequest` (on decision or respawn) resets the dedup set for that id,
so a subsequent identical id on a new bridge can notify again. (init clears pendingPermRequest
already; dedup set is cleared on init via the same lifecycle.)

### RF-FIX-02 — Notification carries the session label

GIVEN the session label is known at the time the perm-request arrives
WHEN the OS notification is emitted (RF-FIX-01)
THEN the notification body includes the session label so the user can identify which session
needs attention when multiple sessions are open.

## Acceptance Criteria

- `notifyPendingDecision(sessionLabel, toolName)` exported from `src/utils/notifications.ts`.
- `AgentSessionStore` accepts an optional `onPendingDecision` callback; `getOrCreateAgentSessionStore`
  passes it through when supplied.
- Callback is invoked on perm-request arrival iff `document.hidden` is true AND request id is new.
- Notified-id set is cleared when `init` resets `pendingPermRequest` (respawn path).
- Vitest regression test fails before fix, passes after (unit-level, no DOM renderer required).
