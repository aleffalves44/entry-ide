/**
 * Pure derivation of the SDD pipeline phases from a `PipelineState`
 * snapshot (filesystem/git facts computed by the Rust backend).
 *
 * Kept free of React/Tauri so it can be unit-tested directly.
 */

export interface PipelineState {
  branch: string | null;
  commits_ahead: number | null;
  spike_doc: string | null;
  spec_doc: string | null;
  plan_doc: string | null;
  pr_number: number | null;
  pr_url: string | null;
  pr_state: string | null;
}

export type PhaseKey = "spike" | "plan" | "task" | "pr";
export type PhaseStatus = "done" | "running" | "pending";

export interface PipelinePhase {
  key: PhaseKey;
  label: string;
  /** Slash command dispatched into the chat (without the leading `/`). */
  command: string;
  status: PhaseStatus;
  /** Artifact paths that prove the phase happened (clickable in the UI). */
  artifacts: { label: string; path: string }[];
  /** Extra line under the phase (e.g. "3 commits", "PR #42 open"). */
  detail: string | null;
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
  spike: "investigacao/discovery — o plugin pedira chave Jira ou tema ao iniciar",
  plan: "gera SPEC.md + PLAN.md — o plugin pedira CRED-XXX ou descricao da task",
  task: "implementa o PLAN existente no worktree",
  pr: "abre pull request para o branch atual",
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
          ? `${s.commits_ahead} commit${s.commits_ahead === 1 ? "" : "s"}${s.branch ? ` em ${s.branch}` : ""}`
          : s.branch
            ? `branch ${s.branch}`
            : null,
    },
    {
      key: "pr",
      label: "PR",
      command: PHASE_COMMANDS.pr,
      status: status("pr", prDone),
      artifacts: [],
      detail: s.pr_number
        ? `PR #${s.pr_number}${s.pr_state ? ` · ${s.pr_state.toLowerCase()}` : ""}`
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
