/**
 * loopStore — the loop-engineering engine (M6).
 *
 * A loop re-submits a prompt to an agent session every time the previous
 * turn completes, until a stop condition fires.  The engine is plain
 * TypeScript (no React): it subscribes directly to the session's agent
 * store, so loops keep running while the pane is hidden or the user is
 * looking at another session.
 *
 * GUARDRAILS ARE MANDATORY — every loop stops on its own at whichever
 * fires first:
 *   • maxIterations   — hard cap on turns started by the loop
 *   • costCeilingUsd  — session cost delta since the loop started
 *                       (from the SDK result event's cumulative
 *                       total_cost_usd)
 *   • stopMarker      — the assistant's last message contains the
 *                       marker (presets instruct the agent to emit
 *                       "LOOP_DONE" when the goal is reached)
 * Manual stop is always available and immediate.
 */
import { peekAgentSessionStore } from "../agent/agentSessionStore";
import { isTextBlock } from "../agent/types";
import { submitToAgent } from "../utils/submitToAgent";

export interface LoopConfig {
  /** Prompt re-submitted on every iteration. */
  prompt: string;
  /** Hard cap on iterations (turns started by the loop). */
  maxIterations: number;
  /** Hard cap on session cost spent by the loop, in USD. */
  costCeilingUsd: number;
  /** Pause between a turn completing and the next submission. */
  delayMs: number;
  /** Assistant text that ends the loop as success. */
  stopMarker: string;
}

export type LoopStatus = "running" | "waiting" | "done" | "stopped";

export interface LoopState {
  config: LoopConfig;
  status: LoopStatus;
  /** Iterations started (1-based once the first prompt is sent). */
  iteration: number;
  /** Cost spent since the loop started (USD). */
  spentUsd: number;
  /** Why the loop ended (done/stopped states). */
  stopReason: string | null;
}

/** Injectable for tests. */
export interface LoopDeps {
  peekStore: typeof peekAgentSessionStore;
  submit: (sessionId: string, text: string) => Promise<void>;
}

const defaultDeps: LoopDeps = {
  peekStore: peekAgentSessionStore,
  submit: (sessionId, text) => submitToAgent(sessionId, text, []),
};

interface LoopRuntime {
  state: LoopState;
  unsubscribe: (() => void) | null;
  timer: ReturnType<typeof setTimeout> | null;
  lastResultAt: number | null;
  baselineCostUsd: number;
  deps: LoopDeps;
}

const loops = new Map<string, LoopRuntime>();
const listeners = new Set<() => void>();

// useSyncExternalStore needs a stable snapshot between notifications —
// cache the Map-of-states and invalidate on notify.
let snapshotCache: Map<string, LoopState> | null = null;

function notify(): void {
  snapshotCache = null;
  for (const l of listeners) l();
}

export function subscribeLoops(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLoopsSnapshot(): Map<string, LoopState> {
  if (!snapshotCache) {
    snapshotCache = new Map(
      [...loops.entries()].map(([id, rt]) => [id, { ...rt.state }]),
    );
  }
  return snapshotCache;
}

export function getLoopState(sessionId: string): LoopState | null {
  return getLoopsSnapshot().get(sessionId) ?? null;
}

function lastAssistantText(
  messages: { role: string; blocks: unknown[] }[] | undefined,
): string {
  const list = messages ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.role !== "assistant") continue;
    let text = "";
    for (const b of m.blocks) {
      if (isTextBlock(b as never)) text += (b as { text: string }).text;
    }
    return text;
  }
  return "";
}

function endLoop(rt: LoopRuntime, status: "done" | "stopped", reason: string): void {
  rt.unsubscribe?.();
  rt.unsubscribe = null;
  if (rt.timer) clearTimeout(rt.timer);
  rt.timer = null;
  rt.state = { ...rt.state, status, stopReason: reason };
  notify();
}

function submitIteration(sessionId: string, rt: LoopRuntime): void {
  rt.timer = null;
  rt.state = {
    ...rt.state,
    status: "running",
    iteration: rt.state.iteration + 1,
  };
  notify();
  rt.deps.submit(sessionId, rt.state.config.prompt).catch((err) => {
    endLoop(rt, "stopped", `falha ao enviar prompt: ${err}`);
  });
}

/** Handle a completed turn: update spend, check every stop condition,
 *  then either end the loop or schedule the next iteration. */
function onTurnComplete(sessionId: string, rt: LoopRuntime): void {
  const store = rt.deps.peekStore(sessionId);
  if (!store) {
    endLoop(rt, "stopped", "sessão encerrada");
    return;
  }
  const snap = store.getSnapshot();
  const cumulative = snap.state.resultEvent?.total_cost_usd;
  if (typeof cumulative === "number") {
    rt.state = { ...rt.state, spentUsd: Math.max(0, cumulative - rt.baselineCostUsd) };
  }

  const { config } = rt.state;
  if (lastAssistantText(snap.state.messages).includes(config.stopMarker)) {
    endLoop(rt, "done", `objetivo atingido (${config.stopMarker})`);
    return;
  }
  if (rt.state.spentUsd >= config.costCeilingUsd) {
    endLoop(
      rt,
      "stopped",
      `teto de custo atingido ($${rt.state.spentUsd.toFixed(2)} ≥ $${config.costCeilingUsd.toFixed(2)})`,
    );
    return;
  }
  if (rt.state.iteration >= config.maxIterations) {
    endLoop(rt, "stopped", `máximo de ${config.maxIterations} iterações atingido`);
    return;
  }

  rt.state = { ...rt.state, status: "waiting" };
  notify();
  rt.timer = setTimeout(() => submitIteration(sessionId, rt), config.delayMs);
}

export function startLoop(
  sessionId: string,
  config: LoopConfig,
  deps: LoopDeps = defaultDeps,
): boolean {
  const existing = loops.get(sessionId);
  if (existing && (existing.state.status === "running" || existing.state.status === "waiting")) {
    return false; // one loop per session
  }
  const store = deps.peekStore(sessionId);
  if (!store) return false;

  const snap = store.getSnapshot();
  const rt: LoopRuntime = {
    state: {
      config,
      status: "running",
      iteration: 0,
      spentUsd: 0,
      stopReason: null,
    },
    unsubscribe: null,
    timer: null,
    lastResultAt: snap.state.resultEventAt,
    baselineCostUsd: snap.state.resultEvent?.total_cost_usd ?? 0,
    deps,
  };
  loops.set(sessionId, rt);

  rt.unsubscribe = store.subscribe(() => {
    const s = deps.peekStore(sessionId);
    if (!s) return;
    const current = s.getSnapshot();
    const at = current.state.resultEventAt;
    const streaming =
      current.state.streamingMessageId !== null ||
      current.state.runningToolUseIds.size > 0;
    if (at !== null && at !== rt.lastResultAt && !streaming) {
      rt.lastResultAt = at;
      // Only react while the loop is live — a manual turn after `done`
      // must not resurrect it.
      if (rt.state.status === "running") onTurnComplete(sessionId, rt);
    }
  });

  submitIteration(sessionId, rt);
  return true;
}

export function stopLoop(sessionId: string, reason = "interrompido manualmente"): void {
  const rt = loops.get(sessionId);
  if (!rt) return;
  if (rt.state.status === "running" || rt.state.status === "waiting") {
    endLoop(rt, "stopped", reason);
  }
}

/** Clear a finished loop so the UI returns to the idle state. */
export function clearLoop(sessionId: string): void {
  const rt = loops.get(sessionId);
  if (!rt) return;
  if (rt.state.status === "running" || rt.state.status === "waiting") return;
  loops.delete(sessionId);
  notify();
}

export function _resetLoopsForTest(): void {
  for (const [id, rt] of loops) {
    rt.unsubscribe?.();
    if (rt.timer) clearTimeout(rt.timer);
    loops.delete(id);
  }
  snapshotCache = null;
}
