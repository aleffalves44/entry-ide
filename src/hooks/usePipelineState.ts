/**
 * Shared SDD-pipeline state hook — consumed by the Workbench Pipeline
 * tab (full panel) and the in-chat PipelineStrip.
 *
 * Owns: worktree-state fetching (`get_pipeline_state`), refresh cadence
 * (mount + turn completion + manual), running-phase detection from the
 * live agent stream, and plugin presence.  Pure derivations live in
 * `src/utils/pipelinePhases.ts`.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAgentPrewarm } from "../agent/useAgentPrewarm";
import { peekAgentSessionStore } from "../agent/agentSessionStore";
import { recordDeliveryEvent } from "../api/delivery";
import { commandFromUserText } from "../agent/frameworkMetrics";
import { isTextBlock } from "../agent/types";
import { getPipelineState } from "../api/pipeline";
import {
  derivePipelinePhases,
  hasHarnessPlugin,
  runningPhaseFromCommand,
  type PipelinePhase,
  type PipelineState,
} from "../utils/pipelinePhases";
import type { SessionData } from "../types/session";

const EMPTY_SNAPSHOT = null;

/** Subscribe to the session's agent store when it exists (it does for any
 *  mounted agent session); render inert otherwise. */
function useAgentStoreState(sessionId: string) {
  const store = peekAgentSessionStore(sessionId);
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    () => (store ? store.getSnapshot() : EMPTY_SNAPSHOT),
  );
}

export interface PipelineStateHook {
  phases: PipelinePhase[];
  pipeline: PipelineState | null;
  loading: boolean;
  refresh: () => void;
  /** A turn is currently streaming in this session. */
  isStreaming: boolean;
  /** Session init arrived and no harness-cmd skill was listed. */
  pluginMissing: boolean;
  /** Init arrived and the plugin IS present. */
  pluginPresent: boolean;
}

export function usePipelineState(session: SessionData): PipelineStateHook {
  const snapshot = useAgentStoreState(session.id);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [loading, setLoading] = useState(false);

  const workingDir = session.working_directory;

  const refresh = useCallback(() => {
    if (!workingDir) return;
    setLoading(true);
    getPipelineState(workingDir)
      .then(setPipeline)
      .catch(() => setPipeline(null))
      .finally(() => setLoading(false));
  }, [workingDir]);

  // Refresh on mount and whenever a turn completes — the turn may have
  // produced artifacts (SPEC.md, commits, a PR).
  const resultEventAt = snapshot?.state.resultEventAt ?? null;
  useEffect(() => {
    refresh();
  }, [refresh, resultEventAt]);

  const isStreaming =
    snapshot !== null &&
    (snapshot.state.streamingMessageId !== null ||
      snapshot.state.runningToolUseIds.size > 0);

  // The command that initiated the in-flight turn, for "running" state.
  const messages = snapshot?.state.messages;
  const lastCommand = useMemo(() => {
    const list = messages ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.role !== "user" || m.parentToolUseId) continue;
      let text = "";
      for (const b of m.blocks) {
        if (isTextBlock(b)) text += b.text;
      }
      return commandFromUserText(text);
    }
    return null;
  }, [messages]);

  // ─── Delivery milestones (M5) ─────────────────────────────────────
  // Observed facts become delivery_events rows; the backend dedupes on
  // (session_id, event, pr_number), so firing on every refresh is safe.
  // PR events carry gh's exact createdAt/mergedAt timestamps.
  const hasUserMessage = (messages ?? []).some(
    (m) => m.role === "user" && !m.parentToolUseId,
  );
  useEffect(() => {
    const base = {
      session_id: session.id,
      repo_path: workingDir ?? null,
      branch: pipeline?.branch ?? null,
      pr_number: null,
      pr_url: null,
      recorded_at: null,
    };
    const fire = (ev: Parameters<typeof recordDeliveryEvent>[0]) =>
      recordDeliveryEvent(ev).catch(() => undefined);

    if (hasUserMessage) {
      fire({ ...base, event: "task_started" });
    }
    if (!pipeline) return;
    if ((pipeline.commits_ahead ?? 0) > 0) {
      fire({ ...base, event: "first_commit" });
    }
    if (pipeline.pr_url) {
      const pr = {
        pr_number: pipeline.pr_number ?? null,
        pr_url: pipeline.pr_url,
      };
      fire({
        ...base,
        ...pr,
        event: "pr_opened",
        recorded_at: pipeline.pr_created_at ?? null,
      });
      if (pipeline.pr_state === "MERGED") {
        fire({
          ...base,
          ...pr,
          event: "pr_merged",
          recorded_at: pipeline.pr_merged_at ?? null,
        });
      }
    }
  }, [session.id, workingDir, pipeline, hasUserMessage]);

  const runningPhase = runningPhaseFromCommand(lastCommand, isStreaming);
  const phases = useMemo(
    () => derivePipelinePhases(pipeline, runningPhase),
    [pipeline, runningPhase],
  );

  // Plugin presence: the SDK only emits `init` after the FIRST user
  // message, so a fresh session would hide the pipeline UI exactly when
  // one-click phase dispatch is most useful.  Until init arrives, fall
  // back to the static prewarm scan (which includes installed plugin
  // commands).  Init stays authoritative once it lands — including for
  // `pluginMissing`, which is only asserted from real init data.
  const prewarm = useAgentPrewarm(workingDir);
  const init = snapshot?.state.initEvent ?? null;
  const pluginMissing = init !== null && !hasHarnessPlugin(init.slash_commands);
  const pluginPresent = init !== null
    ? hasHarnessPlugin(init.slash_commands)
    : hasHarnessPlugin(prewarm.slashCommands);

  return { phases, pipeline, loading, refresh, isStreaming, pluginMissing, pluginPresent };
}
