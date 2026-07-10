/**
 * Pure derivation of the unified "Workflow" timeline — the single-column
 * chronological view that composes, for one task, the pieces today spread
 * across the Workbench's Pipeline / Files / Git / Metrics tabs:
 *
 *   • current pipeline phase (status + command),
 *   • generated `.md` artifacts (spike / spec / plan), clickable,
 *   • git-changed files (staged + unstaged + untracked), openable as diff,
 *   • token/cost of the current turn/phase.
 *
 * Pure (no React / no IO) so it can be unit-tested directly.  Reuses the
 * types from `pipelinePhases.ts` and `types/git.ts` rather than redefining
 * them.  The hook in `useWorkflowTimeline` feeds it live data.
 */
import type { GitFile, GitSessionStatus } from "../types/git";
import type { FrameworkUsageEntry } from "../api/frameworkMetrics";
import {
  derivePipelinePhases,
  type PhaseKey,
  type PipelinePhase,
  type PipelineState,
} from "./pipelinePhases";

/** One entry in the artifacts section (a generated `.md`). */
export interface TimelineArtifact {
  label: string;
  path: string;
  /** Owning phase, so the UI can group/label it. */
  phase: PhaseKey;
}

/** Token/cost snapshot for the running (or last) phase. */
export interface TimelineCost {
  phase: PhaseKey | null;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number | null;
}

/** A logical section of the timeline, in display order.  The view renders
 *  them top-to-bottom; each kind carries just enough to be rendered. */
export type TimelineSection =
  | { kind: "phase"; phase: PipelinePhase }
  | { kind: "artifacts"; items: TimelineArtifact[] }
  | { kind: "files"; files: GitFile[] }
  | { kind: "cost"; cost: TimelineCost };

export interface WorkflowTimeline {
  sections: TimelineSection[];
  /** Convenience flags for the host component. */
  hasArtifacts: boolean;
  changedFileCount: number;
  hasCost: boolean;
}

/** Collect every artifact the pipeline knows about, in phase order. */
export function collectArtifacts(phases: PipelinePhase[]): TimelineArtifact[] {
  const out: TimelineArtifact[] = [];
  for (const p of phases) {
    for (const a of p.artifacts) {
      out.push({ label: a.label, path: a.path, phase: p.key });
    }
  }
  return out;
}

/** Flatten the (possibly multi-project) git status into one deduped file
 *  list, sorted by area then path so the timeline is stable. */
export function collectChangedFiles(
  git: GitSessionStatus | null,
): GitFile[] {
  if (!git || !git.projects) return [];
  const seen = new Set<string>();
  const out: GitFile[] = [];
  for (const project of git.projects) {
    for (const f of project.files) {
      const key = `${f.area}:${f.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  const areaOrder: Record<string, number> = { staged: 0, unstaged: 1, untracked: 2 };
  return out.sort((a, b) => {
    const ao = areaOrder[a.area] ?? 3;
    const bo = areaOrder[b.area] ?? 3;
    if (ao !== bo) return ao - bo;
    return a.path.localeCompare(b.path);
  });
}

/** Sum `turn`-kind rows that belong to the running phase (or, when idle,
 *  the latest phase that has any rows) into a compact cost snapshot.
 *  `model`/`agent` rows are intentionally excluded — only `turn` rows are
 *  authoritative totals (see frameworkMetrics.ts). */
export function deriveTimelineCost(
  rows: FrameworkUsageEntry[],
  runningPhase: PhaseKey | null,
): TimelineCost {
  const byPhase = new Map<PhaseKey | null, TimelineCost>();
  const ensure = (key: PhaseKey | null): TimelineCost => {
    let c = byPhase.get(key);
    if (!c) {
      c = {
        phase: key,
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: null,
      };
      byPhase.set(key, c);
    }
    return c;
  };

  for (const r of rows) {
    if (r.kind !== "turn") continue;
    const phase = (r.phase as PhaseKey | null) ?? null;
    const c = ensure(phase);
    c.turns += 1;
    c.inputTokens += r.input_tokens;
    c.outputTokens += r.output_tokens;
    c.costUsd += r.cost_usd;
    if (typeof r.duration_ms === "number") {
      c.durationMs = (c.durationMs ?? 0) + r.duration_ms;
    }
  }

  // Prefer the running phase; fall back to whichever phase has rows
  // (newest by phase order), else a zero total.
  if (runningPhase && byPhase.has(runningPhase)) {
    return byPhase.get(runningPhase)!;
  }
  const order: PhaseKey[] = ["pr", "task", "plan", "spike"];
  for (const key of order) {
    if (byPhase.has(key)) return byPhase.get(key)!;
  }
  if (byPhase.has(null)) return byPhase.get(null)!;
  return { phase: null, turns: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: null };
}

/**
 * Compose the timeline.  `runningPhase` is the phase whose command initiated
 * the in-flight turn (null when idle); `metricsRows` are the session's
 * `framework_usage` rows (any time window — cost is filtered by phase here).
 */
export function deriveWorkflowTimeline(
  pipeline: PipelineState | null,
  runningPhase: PhaseKey | null,
  git: GitSessionStatus | null,
  metricsRows: FrameworkUsageEntry[],
): WorkflowTimeline {
  const phases = derivePipelinePhases(pipeline, runningPhase);

  // 1. Phases (always present — the backbone of the view).
  const sections: TimelineSection[] = phases.map((phase) => ({
    kind: "phase",
    phase,
  }));

  // 2. Artifacts — only when at least one `.md` exists.
  const artifacts = collectArtifacts(phases);
  const hasArtifacts = artifacts.length > 0;
  if (hasArtifacts) {
    sections.push({ kind: "artifacts", items: artifacts });
  }

  // 3. Changed files — only when the worktree has changes.
  const files = collectChangedFiles(git);
  if (files.length > 0) {
    sections.push({ kind: "files", files });
  }

  // 4. Cost — only when there is something to show.
  const cost = deriveTimelineCost(metricsRows, runningPhase);
  const hasCost = cost.turns > 0 || cost.costUsd > 0 || cost.outputTokens > 0;
  if (hasCost) {
    sections.push({ kind: "cost", cost });
  }

  return {
    sections,
    hasArtifacts,
    changedFileCount: files.length,
    hasCost,
  };
}