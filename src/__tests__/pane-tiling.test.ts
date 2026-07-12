/**
 * Pane Tiling Test Suite (M1 — multipane sessions)
 *
 * Every new session opens as a pane BESIDE the existing layout via
 * APPEND_PANE, so several agent sessions stay visible at the same time.
 * Existing panes keep a width share proportional to their count.
 */
import { describe, it, expect, vi } from "vitest";

// ─── Mock Tauri APIs (same surface as state-session-bugs.test.ts) ───
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.reject(new Error("mocked"))),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("../terminal/TerminalPool", () => ({
  createTerminal: vi.fn(),
  destroy: vi.fn(),
  updateSettings: vi.fn(),
  writeScrollback: vi.fn(),
  focusTerminal: vi.fn(),
  refitActive: vi.fn(),
}));
vi.mock("../utils/notifications", () => ({
  initNotifications: vi.fn(),
  notifyLongRunningDone: vi.fn(),
}));

import { sessionReducer, initialState } from "../state/SessionContext";
import type { SessionData } from "../types/session";
import { collectPanes, SplitNode } from "../state/layoutTypes";

function makeSession(overrides?: Partial<SessionData>): SessionData {
  return {
    id: "sess-1",
    label: "Session 1",
    color: "#ff0000",
    group: null,
    phase: "idle",
    working_directory: "/home/user/project",
    shell: "bash",
    created_at: "2025-01-01T00:00:00Z",
    last_activity_at: "2025-01-01T00:00:00Z",
    workspace_paths: [],
    detected_agent: null,
    metrics: {
      output_lines: 0,
      error_count: 0,
      stuck_score: 0,
      token_usage: {},
      tool_calls: [],
      tool_call_summary: {},
      files_touched: [],
      recent_errors: [],
      recent_actions: [],
      available_actions: [],
      memory_facts: [],
      latency_p50_ms: null,
      latency_p95_ms: null,
      latency_samples: [],
      token_history: [],
    },
    ai_provider: null,
    context_injected: false,
    ...overrides,
  };
}

describe("APPEND_PANE", () => {
  it("becomes the root pane when no layout exists", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "solo" }) });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "solo" });
    expect(state.layout.root?.type).toBe("pane");
    expect(state.activeSessionId).toBe("solo");
    expect(state.layout.focusedPaneId).toBe(
      collectPanes(state.layout.root!)[0].id,
    );
  });

  it("tiles a new session beside the existing layout — never replaces panes", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "s1" }) });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "s2" }) });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s1" });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s2" });

    const panes = collectPanes(state.layout.root!);
    expect(panes.map((p) => p.sessionId)).toEqual(["s1", "s2"]);
    // Focus and activity land on the new session
    expect(state.layout.focusedPaneId).toBe(panes[1].id);
    expect(state.activeSessionId).toBe("s2");
    // Two panes split evenly
    expect((state.layout.root as SplitNode).ratio).toBeCloseTo(1 / 2);
  });

  it("keeps width shares proportional as sessions accumulate", () => {
    let state = initialState;
    for (const id of ["a", "b", "c"]) {
      state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id }) });
      state = sessionReducer(state, { type: "APPEND_PANE", sessionId: id });
    }

    const panes = collectPanes(state.layout.root!);
    expect(panes.map((p) => p.sessionId)).toEqual(["a", "b", "c"]);
    // Third append: 2 existing panes keep 2/3, newcomer gets 1/3
    expect((state.layout.root as SplitNode).ratio).toBeCloseTo(2 / 3);
    expect(state.activeSessionId).toBe("c");
  });

  it("split direction is horizontal (side by side)", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "s1" }) });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "s2" }) });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s1" });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s2" });
    expect((state.layout.root as SplitNode).direction).toBe("horizontal");
  });
});
