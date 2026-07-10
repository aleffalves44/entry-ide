/**
 * Pure orchestration logic for the "Rodar workflow" button — chains the
 * SDD phases (spike → plan → task → pr) by dispatching the next pending
 * phase's command and advancing when the turn ends, honouring optional
 * approval stops.
 *
 * Pure (no React / no IO) so the "next phase to run" and "should I pause
 * here?" decisions are unit-testable.  The hook in `useWorkflowRunner`
 * drives the live dispatch + turn-end observation.
 */
import type { PhaseKey, PipelinePhase } from "./pipelinePhases";
import { PHASE_COMMANDS } from "./pipelinePhases";

export type { PhaseKey };

/** Order the runner walks the phases in. */
export const PHASE_ORDER: PhaseKey[] = ["spike", "plan", "task", "pr"];

export interface WorkflowRunnerState {
  running: boolean;
  /** Phase the runner is paused at, awaiting user approval to continue. */
  awaitingApproval: PhaseKey | null;
}

export const IDLE_RUNNER: WorkflowRunnerState = {
  running: false,
  awaitingApproval: null,
};

/**
 * Pick the next phase to dispatch.
 *
 *   • If a turn is streaming (`isStreaming`), the runner must wait — returns
 *     null (nothing to dispatch now; the hook will re-evaluate on turn end).
 *   • Otherwise the next phase is the first one that is neither `done` nor
 *     `running`, in `PHASE_ORDER`.
 *   • Returns null when every phase is done (workflow complete).
 */
export function nextPhaseToRun(
  phases: PipelinePhase[],
  isStreaming: boolean,
): PhaseKey | null {
  if (isStreaming) return null;
  const byKey = new Map(phases.map((p) => [p.key, p]));
  for (const key of PHASE_ORDER) {
    const phase = byKey.get(key);
    if (!phase) continue;
    if (phase.status === "done") continue;
    // `running` shouldn't coexist with `!isStreaming`, but guard anyway.
    if (phase.status === "running") return null;
    return key;
  }
  return null;
}

/**
 * Decide the runner's next state given the live phases/streaming and the
 * configured stop set.  Returns:
 *   • `{ action: "dispatch", phase }` — fire this phase's command now,
 *   • `{ action: "pause", phase }`    — the next pending phase is a stop;
 *                                       surface approval, don't dispatch,
 *   • `{ action: "wait" }`            — a turn is streaming; do nothing,
 *   • `{ action: "complete" }`        — every phase done; stop the runner.
 *
 * `justDispatched` is the phase the runner fired on the previous tick; while
 * its turn is streaming we report `wait` so the hook doesn't re-dispatch.
 * `approvedUpTo` is the phase the user last approved; a stop at or before it
 * is considered cleared so the runner can continue past it.
 */
export type RunnerDecision =
  | { action: "dispatch"; phase: PhaseKey }
  | { action: "pause"; phase: PhaseKey }
  | { action: "wait" }
  | { action: "complete" };

export function decideRunnerAction(
  phases: PipelinePhase[],
  isStreaming: boolean,
  stopAfter: ReadonlySet<PhaseKey>,
  approvedUpTo: PhaseKey | null,
): RunnerDecision {
  const next = nextPhaseToRun(phases, isStreaming);
  if (next === null) {
    // Either streaming (wait) or everything done (complete).
    return isStreaming ? { action: "wait" } : { action: "complete" };
  }

  // Honor a stop configured at `next`, unless the user already approved
  // past it (approvedUpTo is ordered — see isApprovedPastOrAt).
  if (stopAfter.has(next) && !isApprovedPastOrAt(approvedUpTo, next)) {
    return { action: "pause", phase: next };
  }
  return { action: "dispatch", phase: next };
}

/** True when `approved` is `next` or any phase *after* `next` in order. */
export function isApprovedPastOrAt(
  approved: PhaseKey | null,
  next: PhaseKey,
): boolean {
  if (!approved) return false;
  if (approved === next) return true;
  const ai = PHASE_ORDER.indexOf(approved);
  const ni = PHASE_ORDER.indexOf(next);
  return ai > ni;
}

/** The slash-command draft the runner submits for a phase. */
export function phaseCommandDraft(
  phase: PhaseKey,
  taskArgs: string,
): string {
  const cmd = PHASE_COMMANDS[phase];
  const args = taskArgs.trim();
  return args.length > 0 ? `/${cmd} ${args}` : `/${cmd}`;
}