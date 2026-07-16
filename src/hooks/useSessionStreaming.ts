/**
 * useSessionStreaming — whether an agent session currently has a turn in
 * flight.  Mirrors the `isStreaming` derivation shared by
 * `usePipelineState` and `useWorkflowRunner` (`streamingMessageId !==
 * null || runningToolUseIds.size > 0`) so every consumer agrees on the
 * exact edge that marks a turn "running".
 *
 * Returns `false` for non-agent sessions or ones whose store has not been
 * created yet — those never have an in-flight turn.
 */
import { useSyncExternalStore } from "react";
import { peekAgentSessionStore } from "../agent/agentSessionStore";

export function useSessionStreaming(sessionId: string | null): boolean {
  const store = sessionId ? peekAgentSessionStore(sessionId) : undefined;
  const snapshot = useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    () => (store ? store.getSnapshot() : null),
  );
  return (
    snapshot !== null
    && (snapshot.state.streamingMessageId !== null
      || snapshot.state.runningToolUseIds.size > 0)
  );
}