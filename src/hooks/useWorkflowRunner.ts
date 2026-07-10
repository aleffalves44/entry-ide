/**
 * useWorkflowRunner — drives the "Rodar workflow" chaining built on top of
 * the existing per-phase dispatch.
 *
 * State machine (kept intentionally thin):
 *   idle → (start) → dispatching phase N → wait for turn end
 *        → (stop configured at N+1?) pause for approval
 *        → (approved) dispatch phase N+1 → … → complete
 *
 * Turn-end detection reuses the same signals `usePipelineState` watches:
 * `resultEventAt` (turn finished) and `isStreaming` (turn in flight).  No
 * new pipeline tracking — phase done-ness is still derived from the
 * worktree by `derivePipelinePhases`.
 *
 * Cancellation flips `running` off but never kills the in-flight turn; the
 * agent keeps running, the runner just stops chaining the next phase.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { peekAgentSessionStore } from "../agent/agentSessionStore";
import { useSyncExternalStore } from "react";
import { submitToAgent } from "../utils/submitToAgent";
import { usePipelineState } from "./usePipelineState";
import {
  IDLE_RUNNER,
  decideRunnerAction,
  phaseCommandDraft,
  type PhaseKey,
  type RunnerDecision,
  type WorkflowRunnerState,
} from "../utils/workflowRunner";
import type { SessionData } from "../types/session";

function useAgentStoreState(sessionId: string) {
  const store = peekAgentSessionStore(sessionId);
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    () => (store ? store.getSnapshot() : null),
  );
}

export interface WorkflowRunnerHook {
  state: WorkflowRunnerState;
  /** Phases the user has marked as approval stops. */
  stopAfter: ReadonlySet<PhaseKey>;
  toggleStop: (phase: PhaseKey) => void;
  /** Start chaining from the next pending phase. */
  start: () => void;
  /** Resume after an approval pause. */
  approve: () => void;
  /** Stop chaining.  Does not kill the in-flight turn. */
  cancel: () => void;
}

export function useWorkflowRunner(
  session: SessionData,
  taskArgs: string,
): WorkflowRunnerHook {
  const pipeline = usePipelineState(session);
  const snapshot = useAgentStoreState(session.id);

  const [state, setState] = useState<WorkflowRunnerState>(IDLE_RUNNER);
  const [stopAfter, setStopAfter] = useState<ReadonlySet<PhaseKey>>(
    () => new Set<PhaseKey>(["plan"]),
  );

  // The phase the user last approved past; cleared on cancel/complete.
  const approvedRef = useRef<PhaseKey | null>(null);
  // The phase we just dispatched, so we don't double-dispatch while its
  // turn streams.
  const dispatchedRef = useRef<PhaseKey | null>(null);
  // Re-entrancy guard: a single decision per state edge.
  const actingRef = useRef(false);

  const isStreaming =
    snapshot !== null &&
    (snapshot.state.streamingMessageId !== null ||
      snapshot.state.runningToolUseIds.size > 0);

  const toggleStop = useCallback((phase: PhaseKey) => {
    setStopAfter((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    approvedRef.current = null;
    dispatchedRef.current = null;
    setState({ running: true, awaitingApproval: null });
  }, []);

  const approve = useCallback(() => {
    const waiting = state.awaitingApproval;
    if (!waiting) return;
    approvedRef.current = waiting;
    dispatchedRef.current = null;
    setState({ running: true, awaitingApproval: null });
  }, [state.awaitingApproval]);

  const cancel = useCallback(() => {
    approvedRef.current = null;
    dispatchedRef.current = null;
    setState(IDLE_RUNNER);
  }, []);

  // Core loop: whenever the runner is active and the live phases/streaming
  // edge changes, decide what to do next.
  useEffect(() => {
    if (!state.running) return;
    if (state.awaitingApproval) return;

    let decision: RunnerDecision;
    try {
      decision = decideRunnerAction(
        pipeline.phases,
        isStreaming,
        stopAfter,
        approvedRef.current,
      );
    } catch (e) {
      console.warn("[useWorkflowRunner] decision failed:", e);
      setState(IDLE_RUNNER);
      return;
    }

    if (decision.action === "complete") {
      approvedRef.current = null;
      dispatchedRef.current = null;
      setState(IDLE_RUNNER);
      return;
    }
    if (decision.action === "wait") {
      return; // turn in flight; re-eval when it ends
    }
    if (decision.action === "pause") {
      if (state.awaitingApproval === decision.phase) return;
      setState({ running: true, awaitingApproval: decision.phase });
      return;
    }
    // dispatch
    if (actingRef.current) return;
    if (dispatchedRef.current === decision.phase && isStreaming) return;
    actingRef.current = true;
    const draft = phaseCommandDraft(decision.phase, taskArgs);
    dispatchedRef.current = decision.phase;
    submitToAgent(session.id, draft, [])
      .catch((e) => console.warn("[useWorkflowRunner] dispatch failed:", e))
      .finally(() => {
        actingRef.current = false;
      });
  }, [
    state.running,
    state.awaitingApproval,
    pipeline.phases,
    isStreaming,
    stopAfter,
    taskArgs,
    session.id,
  ]);

  return { state, stopAfter, toggleStop, start, approve, cancel };
}