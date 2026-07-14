/**
 * Pure derivation of the SDD pipeline phases from a `PipelineState`
 * snapshot (filesystem/git facts computed by the Rust backend).
 *
 * Kept free of React/Tauri so it can be unit-tested directly.
 */
import type { MessageKey } from "../i18n";

export interface PipelineState {
  branch: string | null;
  commits_ahead: number | null;
  spike_doc: string | null;
  spec_doc: string | null;
  plan_doc: string | null;
  pr_number: number | null;
  pr_url: string | null;
  pr_state: string | null;
  /** Exact PR timestamps from gh (ISO 8601) — used by delivery metrics. */
  pr_created_at?: string | null;
  pr_merged_at?: string | null;
}

export type PhaseKey = "spike" | "plan" | "task" | "pr";
export type PhaseStatus = "done" | "running" | "pending";

/** Structured (locale-agnostic) facts for the phase's extra line. The UI
 *  turns this into localized copy via `formatPhaseDetail`. PR state stays a
 *  raw technical token (not translated). */
export type PhaseDetail =
  | { kind: "commits"; count: number; branch: string | null }
  | { kind: "branch"; branch: string }
  | { kind: "pr"; prNumber: number; prState: string | null };

/** Minimal translate surface — decouples this pure util from the i18n hook. */
type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface PipelinePhase {
  key: PhaseKey;
  label: string;
  /** Slash command dispatched into the chat (without the leading `/`). */
  command: string;
  status: PhaseStatus;
  /** Artifact paths that prove the phase happened (clickable in the UI). */
  artifacts: { label: string; path: string }[];
  /** Structured extra line under the phase (e.g. commits, PR). Null hides it. */
  detail: PhaseDetail | null;
}

/** Render a `PhaseDetail` into localized copy. Kept next to the derivation so
 *  both pipeline surfaces (PipelinePanel, WorkflowTimelinePanel) share it. */
export function formatPhaseDetail(detail: PhaseDetail, t: TranslateFn): string {
  switch (detail.kind) {
    case "commits": {
      const base = t(
        detail.count === 1 ? "pipeline.detail.commit" : "pipeline.detail.commits",
        { count: detail.count },
      );
      return detail.branch
        ? base + t("pipeline.detail.onBranch", { branch: detail.branch })
        : base;
    }
    case "branch":
      return t("pipeline.detail.branch", { branch: detail.branch });
    case "pr":
      return detail.prState
        ? `PR #${detail.prNumber} · ${detail.prState.toLowerCase()}`
        : `PR #${detail.prNumber}`;
  }
}

/** Commands the panel dispatches.  The plugin owns the workflow — these
 *  are just the entry points; if the plugin renames a skill this is the
 *  single place to update. */
export const PHASE_COMMANDS: Record<PhaseKey, string> = {
  spike: "harness-cmd:spike",
  plan: "harness-cmd:plan",
  task: "harness-cmd:task",
  pr: "harness-cmd:pr",
};

/** Static descriptions shown in the expanded phase section.  Each entry
 *  explains what the phase does and what context the plugin will ask for
 *  in chat.  Text is FLEXIBLE; existence, keys, and non-empty values are RIGID. */
export const PHASE_DESCRIPTIONS: Record<PhaseKey, string> = {
  spike: "investigacao/discovery — informe a chave Jira ou o tema a investigar",
  plan: "gera SPEC.md + PLAN.md — informe CRED-XXX ou a descricao da task",
  task: "implementa o PLAN existente no worktree",
  pr: "abre pull request para o branch atual",
};

/** Placeholder shown in each phase's context input.  The text typed there
 *  is appended verbatim as the slash-command argument. */
export const PHASE_PLACEHOLDERS: Record<PhaseKey, string> = {
  spike: "CRED-1234 ou tema a investigar",
  plan: "CRED-1234 ou descrição da feature",
  task: "CRED-1234 ou instruções extras (opcional)",
  pr: "contexto extra para o PR (opcional)",
};

function fileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Derive the four phases.  `runningPhase` comes from the live session
 * (a turn is streaming and was initiated by that phase's command).
 */
export function derivePipelinePhases(
  state: PipelineState | null,
  runningPhase: PhaseKey | null,
): PipelinePhase[] {
  const s: PipelineState = state ?? {
    branch: null,
    commits_ahead: null,
    spike_doc: null,
    spec_doc: null,
    plan_doc: null,
    pr_number: null,
    pr_url: null,
    pr_state: null,
  };

  const spikeDone = s.spike_doc !== null;
  const planDone = s.spec_doc !== null && s.plan_doc !== null;
  const taskDone = (s.commits_ahead ?? 0) > 0;
  const prDone = s.pr_url !== null;

  const status = (key: PhaseKey, done: boolean): PhaseStatus =>
    runningPhase === key ? "running" : done ? "done" : "pending";

  return [
    {
      key: "spike",
      label: "Spike",
      command: PHASE_COMMANDS.spike,
      status: status("spike", spikeDone),
      artifacts: s.spike_doc
        ? [{ label: fileName(s.spike_doc), path: s.spike_doc }]
        : [],
      detail: null,
    },
    {
      key: "plan",
      label: "Plan",
      command: PHASE_COMMANDS.plan,
      status: status("plan", planDone),
      artifacts: [
        ...(s.spec_doc ? [{ label: fileName(s.spec_doc), path: s.spec_doc }] : []),
        ...(s.plan_doc ? [{ label: fileName(s.plan_doc), path: s.plan_doc }] : []),
      ],
      detail: null,
    },
    {
      key: "task",
      label: "Task",
      command: PHASE_COMMANDS.task,
      status: status("task", taskDone),
      artifacts: [],
      detail:
        s.commits_ahead !== null && s.commits_ahead > 0
          ? { kind: "commits", count: s.commits_ahead, branch: s.branch }
          : s.branch
            ? { kind: "branch", branch: s.branch }
            : null,
    },
    {
      key: "pr",
      label: "PR",
      command: PHASE_COMMANDS.pr,
      status: status("pr", prDone),
      artifacts: [],
      detail: s.pr_number
        ? { kind: "pr", prNumber: s.pr_number, prState: s.pr_state }
        : null,
    },
  ];
}

/** Which phase (if any) initiated the currently-streaming turn.
 *  `lastCommand` is the slash command of the latest user message
 *  (e.g. "harness-cmd:plan"); returns null for prose turns. */
export function runningPhaseFromCommand(
  lastCommand: string | null,
  isStreaming: boolean,
): PhaseKey | null {
  if (!isStreaming || !lastCommand) return null;
  const m = /(?:^|:)(spike|plan|task|pr)$/.exec(lastCommand);
  return m ? (m[1] as PhaseKey) : null;
}

/** True when the session's init event lists any harness-cmd skill —
 *  i.e. the plugin is installed and loaded. */
export function hasHarnessPlugin(
  slashCommands: (string | { command: string })[] | undefined | null,
): boolean {
  if (!slashCommands) return false;
  return slashCommands.some((c) => {
    const name = typeof c === "string" ? c : c.command;
    return typeof name === "string" && name.startsWith("harness-cmd:");
  });
}
