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
import { peekAgentSessionStore } from "../agent/agentSessionStore";
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

  const runningPhase = runningPhaseFromCommand(lastCommand, isStreaming);
  const phases = useMemo(
    () => derivePipelinePhases(pipeline, runningPhase),
    [pipeline, runningPhase],
  );

  const init = snapshot?.state.initEvent ?? null;
  const pluginMissing = init !== null && !hasHarnessPlugin(init.slash_commands);
  const pluginPresent = init !== null && hasHarnessPlugin(init.slash_commands);

  return { phases, pipeline, loading, refresh, isStreaming, pluginMissing, pluginPresent };
}
