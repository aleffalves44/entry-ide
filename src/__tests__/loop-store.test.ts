/**
 * loopStore (M6) — loop engine guardrails and lifecycle.
 *
 * Uses a fake agent-session store + injected submit so iterations can be
 * driven deterministically: each `completeTurn` simulates the SDK result
 * event (cumulative cost + assistant text).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startLoop,
  stopLoop,
  getLoopState,
  _resetLoopsForTest,
  type LoopConfig,
  type LoopDeps,
} from "../state/loopStore";

// ─── Fake agent store ────────────────────────────────────────────────

interface FakeState {
  resultEventAt: number | null;
  resultEvent: { total_cost_usd?: number } | null;
  streamingMessageId: string | null;
  runningToolUseIds: Set<string>;
  messages: { role: string; parentToolUseId?: string | null; blocks: { type: string; text: string }[] }[];
}

function makeFakeStore() {
  const listeners = new Set<() => void>();
  let tick = 0;
  const state: FakeState = {
    resultEventAt: null,
    resultEvent: null,
    streamingMessageId: null,
    runningToolUseIds: new Set(),
    messages: [],
  };
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot() {
      return { state };
    },
    /** Simulate a completed turn. */
    completeTurn(opts: { cumulativeCostUsd: number; assistantText?: string }) {
      state.resultEventAt = ++tick;
      state.resultEvent = { total_cost_usd: opts.cumulativeCostUsd };
      if (opts.assistantText !== undefined) {
        state.messages = [
          ...state.messages,
          { role: "assistant", blocks: [{ type: "text", text: opts.assistantText }] },
        ];
      }
      for (const fn of listeners) fn();
    },
  };
}

function makeDeps(fake: ReturnType<typeof makeFakeStore>) {
  const submit = vi.fn(() => Promise.resolve());
  const deps: LoopDeps = {
    peekStore: (() => fake) as unknown as LoopDeps["peekStore"],
    submit,
  };
  return { deps, submit };
}

const CONFIG: LoopConfig = {
  prompt: "roda os testes",
  maxIterations: 3,
  costCeilingUsd: 1.0,
  delayMs: 1, // near-instant scheduling in tests
  stopMarker: "LOOP_DONE",
};

const flushTimers = () => new Promise((r) => setTimeout(r, 5));

describe("loopStore", () => {
  beforeEach(() => _resetLoopsForTest());
  afterEach(() => _resetLoopsForTest());

  it("submits the prompt on start and re-submits after each completed turn", async () => {
    const fake = makeFakeStore();
    const { deps, submit } = makeDeps(fake);

    expect(startLoop("s1", CONFIG, deps)).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(getLoopState("s1")?.iteration).toBe(1);

    fake.completeTurn({ cumulativeCostUsd: 0.1, assistantText: "corrigi 2 testes" });
    await flushTimers();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(getLoopState("s1")?.iteration).toBe(2);
  });

  it("ends as done when the assistant emits the stop marker", async () => {
    const fake = makeFakeStore();
    const { deps, submit } = makeDeps(fake);
    startLoop("s1", CONFIG, deps);

    fake.completeTurn({ cumulativeCostUsd: 0.2, assistantText: "tudo verde. LOOP_DONE" });
    await flushTimers();

    const state = getLoopState("s1")!;
    expect(state.status).toBe("done");
    expect(state.stopReason).toContain("LOOP_DONE");
    expect(submit).toHaveBeenCalledTimes(1); // no extra iteration
  });

  it("stops at the cost ceiling and reports spend as a delta from loop start", async () => {
    const fake = makeFakeStore();
    // Session already spent $5 before the loop — ceiling applies to the DELTA.
    fake.completeTurn({ cumulativeCostUsd: 5.0 });
    const { deps, submit } = makeDeps(fake);
    startLoop("s1", CONFIG, deps);

    fake.completeTurn({ cumulativeCostUsd: 5.4, assistantText: "iterando" });
    await flushTimers();
    // $0.40 < $1.00 — the loop continues (waiting or already re-running)
    expect(getLoopState("s1")?.status).not.toBe("stopped");

    fake.completeTurn({ cumulativeCostUsd: 6.2, assistantText: "iterando" });
    await flushTimers();

    const state = getLoopState("s1")!;
    expect(state.status).toBe("stopped");
    expect(state.stopReason).toContain("teto de custo");
    expect(state.spentUsd).toBeCloseTo(1.2);
    expect(submit.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("stops at max iterations", async () => {
    const fake = makeFakeStore();
    const { deps, submit } = makeDeps(fake);
    startLoop("s1", { ...CONFIG, maxIterations: 2 }, deps);

    fake.completeTurn({ cumulativeCostUsd: 0.1, assistantText: "1" });
    await flushTimers(); // iteration 2 submitted
    fake.completeTurn({ cumulativeCostUsd: 0.2, assistantText: "2" });
    await flushTimers();

    const state = getLoopState("s1")!;
    expect(state.status).toBe("stopped");
    expect(state.stopReason).toContain("máximo de 2 iterações");
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("manual stop is immediate and no further prompts are sent", async () => {
    const fake = makeFakeStore();
    const { deps, submit } = makeDeps(fake);
    startLoop("s1", CONFIG, deps);

    stopLoop("s1");
    expect(getLoopState("s1")?.status).toBe("stopped");

    fake.completeTurn({ cumulativeCostUsd: 0.1, assistantText: "tarde demais" });
    await flushTimers();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("refuses a second concurrent loop on the same session", () => {
    const fake = makeFakeStore();
    const { deps } = makeDeps(fake);
    expect(startLoop("s1", CONFIG, deps)).toBe(true);
    expect(startLoop("s1", CONFIG, deps)).toBe(false);
  });
});
