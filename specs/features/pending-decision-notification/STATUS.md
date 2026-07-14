# STATUS: pending-decision-notification

overall_status: in_progress
command: /task
artifacts_root: specs

## Inference (§1 — cached)
- issuetype: none (free text)
- labels: []
- figma-url: no
- SPEC.md present: no (bug-fixer authors own mini-spec)
- agent: bug-fixer
- mode: quick
- tier: light
- pr_policy: open
- agents_gate: user chose "generate AGENTS tree first" (ai-context bootstrap before §2)
- scope decision: notify on ANY pending user decision (perm request, AskUserQuestion, plan approval) when window unfocused

## Bug context
- Report: OS notification not emitted when agent needs user decision.
- Evidence: only notification path is `notifyLongRunningDone` (src/utils/notifications.ts:13) fired on busy→idle >30s in src/state/SessionContext.tsx:1394 (gated by document.hidden).
- `pendingPermRequest` captured in src/agent/agentSessionStore.ts:138 (isPermRequest) — never triggers OS notification.
- AskUserQuestion / plan approval arrive via same canUseTool perm-request channel.

## Steps
- [x] 1. Inference + pr-policy
- [ ] 1b. AGENTS tree bootstrap (ai-context)
- [ ] 2. Writing agent (bug-fixer)
- [ ] 3. Reviewer (reviewer-engineer, tier=light)
- [ ] 4. PR (pr-opener, type=open)
