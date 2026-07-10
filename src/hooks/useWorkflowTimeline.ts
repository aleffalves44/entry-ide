/**
 * useWorkflowTimeline — feeds the unified Workflow view with fresh data
 * synchronised to the agent turn cycle.
 *
 * Composes the three existing sources used by the Workbench's split tabs:
 *   • `usePipelineState` — pipeline phases + running-phase + streaming flag,
 *   • `useGitStatus` — changed files,
 *   • `getFrameworkUsage` — token/cost rows for this session,
 * and runs them through the pure `deriveWorkflowTimeline`.
 *
 * Refetch cadence mirrors `usePipelineState`: re-fetch metrics + git when a
 * turn completes (the `resultEventAt` signal changes).  No new state of its
 * own — everything is derived.
 */
import { useCallback, useEffect, useState } from "react";
import { usePipelineState } from "./usePipelineState";
import { useGitStatus } from "./useGitStatus";
import { getFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import {
  deriveWorkflowTimeline,
  type WorkflowTimeline,
} from "../utils/workflowTimeline";
import type { SessionData } from "../types/session";

export interface WorkflowTimelineHook {
  timeline: WorkflowTimeline;
  /** Derived pipeline phases (backbone of the timeline). */
  phases: import("../utils/pipelinePhases").PipelinePhase[];
  /** Re-derive on demand (manual refresh button). */
  refresh: () => void;
  loading: boolean;
  isStreaming: boolean;
  pluginMissing: boolean;
  pluginPresent: boolean;
}

const EMPTY: WorkflowTimeline = {
  sections: [],
  hasArtifacts: false,
  changedFileCount: 0,
  hasCost: false,
};

export function useWorkflowTimeline(session: SessionData): WorkflowTimelineHook {
  const pipeline = usePipelineState(session);
  const git = useGitStatus(session.id, pipeline.pluginPresent, 3000);

  const [rows, setRows] = useState<FrameworkUsageEntry[]>([]);

  const refresh = useCallback(() => {
    getFrameworkUsage({ sessionId: session.id })
      .then(setRows)
      .catch((e) => console.warn("[useWorkflowTimeline] metrics load failed:", e));
    pipeline.refresh();
    git.refresh();
  }, [session.id, pipeline, git]);

  // Re-fetch metrics whenever the worktree state or streaming edge changes
  // (mount, turn start/end).  `pipeline` re-runs its own fetch on turn
  // completion via `resultEventAt`; this effect piggybacks on the same
  // edges (pipeline snapshot identity + isStreaming flips) so the cost
  // section reflects the latest `framework_usage` rows.
  useEffect(() => {
    getFrameworkUsage({ sessionId: session.id })
      .then(setRows)
      .catch(() => undefined);
  }, [session.id, pipeline.pipeline, pipeline.isStreaming]);

  const timeline =
    pipeline.pluginPresent || pipeline.pluginMissing
      ? deriveWorkflowTimeline(
          pipeline.pipeline,
          // runningPhase is derived inside usePipelineState via phases; pull
          // the running one back out of the derived phases for the cost filter.
          pipeline.phases.find((p) => p.status === "running")?.key ?? null,
          git.status,
          rows,
        )
      : EMPTY;

  return {
    timeline,
    phases: pipeline.phases,
    refresh,
    loading: pipeline.loading,
    isStreaming: pipeline.isStreaming,
    pluginMissing: pipeline.pluginMissing,
    pluginPresent: pipeline.pluginPresent,
  };
}