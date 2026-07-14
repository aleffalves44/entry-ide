/**
 * English dictionary — the SOURCE OF TRUTH for message keys.
 *
 * `en`'s keys define the `MessageKey` type; every other locale is a
 * `Record<MessageKey, string>`, so a missing/extra key fails the type check.
 * Keep entries grouped by the component that owns them.
 *
 * Interpolation: `{name}` placeholders are filled by `translate(...)`. Only
 * user-visible copy lives here — command names, paths, acronyms (SDD), and
 * formatted numbers stay in the components as technical values.
 */

export const en = {
  // ── Shared ──────────────────────────────────────────────────────────
  "common.cancel": "Cancel",
  "common.send": "Send",
  "common.close": "Close",
  "common.cost": "Cost",
  "common.status": "Status",
  "common.group": "Group",
  "common.total": "Total",
  "settings.language": "Language",
  "phase.done": "done",
  "phase.running": "running…",
  "phase.pending": "pending",

  // ── LoopBar ─────────────────────────────────────────────────────────
  "loop.idleButton": "⟳ Loop",
  "loop.idleTitle": "Run a prompt in a loop until a stop condition (with a cost cap)",
  "loop.doneLabel": "Loop finished",
  "loop.stoppedLabel": "Loop stopped",
  "loop.iterations": "{count} iteration(s)",
  "loop.iterationProgress": "iteration {current}/{max}",
  "loop.spendOfCap": "{spent} / cap {ceiling}",
  "loop.waiting": "waiting for the next iteration…",
  "loop.running": "running…",
  "loop.stop": "Stop",
  "loop.preset": "Preset",
  "loop.promptPlaceholder": "Prompt repeated on each iteration…",
  "loop.maxIterations": "Max. iterations",
  "loop.costCeiling": "Cost cap (US$)",
  "loop.start": "Start loop",
  "loop.hint": "The loop stops on its own at the cost cap, at the max iterations, or when the agent replies ",

  // ── SessionUsageWidget ──────────────────────────────────────────────
  "usage.tag": "USAGE",
  "usage.col.command": "Command",
  "usage.col.turns": "Turns",
  "usage.col.out": "Out",
  "usage.col.agent": "Agent",
  "usage.col.runs": "Runs",
  "usage.col.model": "Model",
  "usage.caption":
    "1 turn = 1 SDK result · 1 run = 1 subagent dispatch · Out = output tokens · Total = in+out+cache (billed volume) · cost computed from usage × each turn's model price.",

  // ── ConsumptionView ─────────────────────────────────────────────────
  "consumption.title": "Overall Usage",
  "consumption.openWindow": "Open in a separate window",
  "consumption.activeSessions": "{count} active session(s)",
  "consumption.activeSessionsTitle": "Active sessions",
  "consumption.col.session": "Session",
  "consumption.focusRow": "Click to focus the session",

  // ── FrameworkMetricsView ────────────────────────────────────────────
  "metrics.exported": "{count} rows exported",
  "metrics.exportFailed": "Export failed: {error}",
  "metrics.scopeSession": "This session",
  "metrics.scopeGlobal": "Global",
  "metrics.exportJsonl": "Export JSONL",
  "metrics.windowTitle": "Open overall usage in a separate window",
  "metrics.window": "⧉ Window",
  "metrics.loading": "Loading metrics…",
  "metrics.emptySession":
    "Metrics show up after this session's first turn — each turn records command, agent, model, and tokens locally.",
  "metrics.emptyGlobal":
    "Metrics show up after the first turn in any agent session — each turn records command, agent, model, and tokens locally.",
  "metrics.turns": "{count} turns",
  "metrics.period": " · last {days} days",
  "metrics.byCommand": "By command",
  "metrics.byAgent": "By agent (total = in+out+cache · cost from usage×model)",
  "metrics.byModel": "By model",
  "metrics.commandRowTitle": "{turns} turns · avg {avg} · {out} out · {dur} avg",
  "metrics.agentRowTitle": "{runs} runs · {out} out",
  "metrics.modelRowTitle": "{turns} turns",

  // ── QuickSessionCreator ─────────────────────────────────────────────
  "quick.title": "New session",
  "quick.closeTitle": "Close (Esc)",
  "quick.loadingProjects": "Loading projects…",
  "quick.noProjects": "No projects registered yet.",
  "quick.addFolder": "Add folder…",
  "quick.project": "Project",
  "quick.folderMissing": " (folder missing)",
  "quick.addFolderTitle": "Add folder as project",
  "quick.branchSelected": "✓ Branch: {branch}",
  "quick.branchNew": " (new)",
  "quick.noWorktree": "No worktree — repo's current branch",
  "quick.advanced": "Advanced…",
  "quick.creating": "Creating…",
  "quick.create": "Create session ⌘↵",

  // ── StatusBar ───────────────────────────────────────────────────────
  "status.mutedOn": "Notifications paused — click to resume",
  "status.mutedOff": "Pause notifications (sound and banners)",
  "status.activeCount": "{count} active",
  "status.justNow": "just now",
  "status.executionMode": "Execution mode",
  "status.mode.manual": "Manual: No automatic suggestions or execution.",
  "status.mode.assisted": "Assisted: Shows suggestions and lets you manually apply fixes.",
  "status.mode.autonomous": "Autonomous: Applies frequent commands and repeated fixes after a countdown.",
  "status.seg.manual": "Manual",
  "status.seg.assisted": "Assisted",
  "status.seg.auto": "Auto",
  "status.working": "WORKING",
  "status.needsInput": "NEEDS INPUT",
  "status.tokensTitle": "Input: {input} · Output: {output}",
  "status.copyCost": "Copy Cost",
  "status.copyTokens": "Copy Token Count",
  "status.copyCwd": "Copy Working Directory",
  "status.projectContext": "Project context: {dir}",
  "status.workingDirectory": "Working directory: {dir}",
  "status.downloading": "Downloading v{version}… {progress}%",
  "status.updateTo": "Update to v{version}",
  "status.checkUpdates": "Check for updates",
  "status.updateReady": "v{version} ready",
  "status.reportBug": "Report a Bug",
  "status.shortcuts": "Keyboard Shortcuts ({keys})",

  // ── PipelinePanel / WorkflowTimelinePanel ───────────────────────────
  "pipeline.pluginMissingTitle": "harness-cmd plugin not found",
  "pipeline.pluginMissingBodyBefore": "The Pipeline panel triggers the ",
  "pipeline.pluginMissingBodyAfter":
    " framework's phases (spike → plan → task → pr). Install the plugin in Claude Code and restart the session:",
  "pipeline.branchTitle": "Current branch",
  "pipeline.refreshTitle": "Re-read worktree state",
  "pipeline.hintBefore": "Phases trigger the matching command in the chat — same as typing ",
  "pipeline.hintAfter":
    ". State is read from the worktree (files, commits, PR), not from internal tracking.",
  "pipeline.desc.spike": "investigation/discovery — provide the Jira key or the topic to investigate",
  "pipeline.desc.plan": "generates SPEC.md + PLAN.md — provide CRED-XXX or the task description",
  "pipeline.desc.task": "implements the existing PLAN in the worktree",
  "pipeline.desc.pr": "opens a pull request for the current branch",
  "pipeline.placeholder.spike": "CRED-1234 or topic to investigate",
  "pipeline.placeholder.plan": "CRED-1234 or feature description",
  "pipeline.placeholder.task": "CRED-1234 or extra instructions (optional)",
  "pipeline.placeholder.pr": "extra context for the PR (optional)",
  "pipeline.detail.commit": "{count} commit",
  "pipeline.detail.commits": "{count} commits",
  "pipeline.detail.onBranch": " on {branch}",
  "pipeline.detail.branch": "branch {branch}",

  // ── WorkflowTimelinePanel (unique) ──────────────────────────────────
  "workflow.pluginMissingBodyBefore": "The Workflow tab tracks the ",
  "workflow.pluginMissingBodyAfter":
    " framework (spike → plan → task → pr). Install the plugin in Claude Code and restart the session:",
  "workflow.waitingTitle": "Waiting for the session…",
  "workflow.waitingBodyBefore": "Workflow tracking appears as soon as the agent session starts with the ",
  "workflow.waitingBodyAfter": " plugin.",
  "workflow.tag": "WORKFLOW",
  "workflow.refreshTitle": "Re-read state",
  "workflow.chainTitle": "Automatically chain the pending phases",
  "workflow.chaining": "Chaining…",
  "workflow.run": "▶ Run workflow",
  "workflow.approveTitle": "Approve and trigger {phase}",
  "workflow.approve": "✓ Approve {phase}",
  "workflow.cancelTitle": "Stop the chaining (does not interrupt the running turn)",
  "workflow.cancel": "■ Cancel",
  "workflow.stopsTitle": "Mark stops for approval between phases",
  "workflow.awaiting": "Paused before {phase} — awaiting approval.",
  "workflow.taskPlaceholder": "e.g. CRED-1234 or task description",
  "workflow.taskInputTitle": "Sent with each phase: /command <this text>",
  "workflow.emptyTimeline": "Pipeline phases appear here once state has been read.",
  "workflow.hint":
    "The timeline consolidates progress, .md artifacts, changed files, and per-phase cost — without switching tabs. State comes from the worktree (files, commits, PR).",
  "workflow.artifactsTitle": "Generated artifacts",
  "workflow.runPhaseTitle": "Send /{command}",
  "workflow.filesTitle": "Changed files · {count}",
  "workflow.openDiffTitle": "Open diff · {area}",
  "workflow.costTitle": "Cost · {phase}",
  "workflow.costTurn": "turn",
  "workflow.cost.turns": "turns",
  "workflow.cost.tokens": "tokens",
  "workflow.cost.duration": "duration",
  "workflow.cost.cost": "cost",
} as const;

export type Dict = typeof en;
export type MessageKey = keyof Dict;
