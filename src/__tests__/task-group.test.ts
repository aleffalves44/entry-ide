/**
 * Task Group Test Suite
 *
 * Covers the multipane task-group flow (M1):
 *   - OPEN_SESSION_GROUP reducer action: atomic agent+terminal split
 *   - createTaskGroup: companion terminal inherits the agent's worktree
 *     cwd and sidebar group; terminal failure degrades gracefully
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
import { createTaskGroup, resolveGroupLabel } from "../state/taskGroup";
import type { CreateSessionOpts, SessionData } from "../types/session";
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

// ─── OPEN_SESSION_GROUP reducer ──────────────────────────────────────

describe("OPEN_SESSION_GROUP", () => {
  it("creates a side-by-side split as root when no layout exists", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "agent-1" }) });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "term-1" }) });
    state = sessionReducer(state, {
      type: "OPEN_SESSION_GROUP",
      agentSessionId: "agent-1",
      terminalSessionId: "term-1",
    });

    const root = state.layout.root as SplitNode;
    expect(root.type).toBe("split");
    expect(root.direction).toBe("horizontal");
    expect(root.ratio).toBe(0.6);

    const panes = collectPanes(root);
    expect(panes).toHaveLength(2);
    expect(panes[0].sessionId).toBe("agent-1"); // agent left
    expect(panes[1].sessionId).toBe("term-1"); // terminal right

    // Focus lands on the agent pane
    expect(state.layout.focusedPaneId).toBe(panes[0].id);
    expect(state.activeSessionId).toBe("agent-1");
  });

  it("tiles beside the existing layout — never replaces open panes", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "old-1" }) });
    state = sessionReducer(state, { type: "INIT_PANE", sessionId: "old-1" });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "agent-2" }) });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "term-2" }) });

    state = sessionReducer(state, {
      type: "OPEN_SESSION_GROUP",
      agentSessionId: "agent-2",
      terminalSessionId: "term-2",
    });

    const panes = collectPanes(state.layout.root!);
    // old-1 stays visible; the group joins on the right
    expect(panes.map((p) => p.sessionId)).toEqual(["old-1", "agent-2", "term-2"]);
    expect(state.activeSessionId).toBe("agent-2");
    // Existing single pane keeps 1/3 of the width (1 existing vs 2 new)
    const root = state.layout.root as SplitNode;
    expect(root.ratio).toBeCloseTo(1 / 3);
  });

  it("stacks multiple groups side by side", () => {
    let state = initialState;
    for (const id of ["a1", "t1", "a2", "t2"]) {
      state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id }) });
    }
    state = sessionReducer(state, { type: "OPEN_SESSION_GROUP", agentSessionId: "a1", terminalSessionId: "t1" });
    state = sessionReducer(state, { type: "OPEN_SESSION_GROUP", agentSessionId: "a2", terminalSessionId: "t2" });

    const sessions = collectPanes(state.layout.root!).map((p) => p.sessionId);
    expect(sessions).toEqual(["a1", "t1", "a2", "t2"]);
    expect(state.activeSessionId).toBe("a2");
  });
});

describe("APPEND_PANE", () => {
  it("tiles a new session beside the existing layout", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "s1" }) });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "s2" }) });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s1" });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s2" });

    const panes = collectPanes(state.layout.root!);
    expect(panes.map((p) => p.sessionId)).toEqual(["s1", "s2"]);
    expect(state.layout.focusedPaneId).toBe(panes[1].id);
    expect(state.activeSessionId).toBe("s2");
  });

  it("becomes the root pane when no layout exists", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession({ id: "solo" }) });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "solo" });
    expect(state.layout.root?.type).toBe("pane");
    expect(state.activeSessionId).toBe("solo");
  });
});

// ─── createTaskGroup ─────────────────────────────────────────────────

describe("createTaskGroup", () => {
  it("creates the terminal in the agent's working directory with the same group", async () => {
    const calls: CreateSessionOpts[] = [];
    const createSession = vi.fn(async (opts?: CreateSessionOpts) => {
      calls.push(opts!);
      if (opts?.mode === "agent") {
        return makeSession({ id: "agent-id", working_directory: "/worktrees/abc/feat-x" });
      }
      return makeSession({ id: "term-id", working_directory: opts?.workingDirectory ?? "" });
    });

    const result = await createTaskGroup(createSession, {
      label: "TSDA-123",
      mode: "agent",
      projectIds: ["proj-1"],
      branchSelections: { "proj-1": { branch: "feat/x", createNew: true } },
      companionTerminal: true,
    });

    expect(result?.agent.id).toBe("agent-id");
    expect(result?.terminal?.id).toBe("term-id");

    const [agentCall, termCall] = calls;
    expect(agentCall.group).toBe("TSDA-123");
    // companionTerminal must not recurse into the agent call
    expect(agentCall.companionTerminal).toBeUndefined();

    expect(termCall.mode).toBe("terminal");
    expect(termCall.group).toBe("TSDA-123");
    expect(termCall.workingDirectory).toBe("/worktrees/abc/feat-x");
    // The terminal must never claim worktrees of its own
    expect(termCall.projectIds).toBeUndefined();
    expect(termCall.branchSelections).toBeUndefined();
  });

  it("returns the agent with terminal:null when the terminal fails", async () => {
    const createSession = vi.fn(async (opts?: CreateSessionOpts) => {
      if (opts?.mode === "agent") return makeSession({ id: "agent-id" });
      throw new Error("pty spawn failed");
    });

    const result = await createTaskGroup(createSession, { label: "t", mode: "agent" });
    expect(result?.agent.id).toBe("agent-id");
    expect(result?.terminal).toBeNull();
  });

  it("returns null when the agent session fails", async () => {
    const createSession = vi.fn(async () => null);
    const result = await createTaskGroup(createSession, { label: "t", mode: "agent" });
    expect(result).toBeNull();
    // No terminal attempt after agent failure
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});

describe("resolveGroupLabel", () => {
  it("prefers explicit group, then label, then first branch", () => {
    expect(resolveGroupLabel({ group: "g", label: "l" })).toBe("g");
    expect(resolveGroupLabel({ label: "l" })).toBe("l");
    expect(
      resolveGroupLabel({ branchSelections: { p: { branch: "feat/y", createNew: false } } }),
    ).toBe("feat/y");
    expect(resolveGroupLabel({})).toBeUndefined();
  });
});
