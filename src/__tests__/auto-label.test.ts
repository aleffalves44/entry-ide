/**
 * autoLabel — session naming from the first message, and the SET_ACTIVE
 * tiling contract (activating a pane-less session opens it BESIDE the
 * layout instead of swapping the focused pane).
 */
import { describe, it, expect, vi } from "vitest";

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

import { deriveSessionLabel, isDefaultSessionLabel } from "../utils/autoLabel";
import { sessionReducer, initialState } from "../state/SessionContext";
import { collectPanes } from "../state/layoutTypes";
import type { SessionData } from "../types/session";

describe("isDefaultSessionLabel", () => {
  it("matches only the backend default pattern", () => {
    expect(isDefaultSessionLabel("Session 3")).toBe(true);
    expect(isDefaultSessionLabel("")).toBe(true);
    expect(isDefaultSessionLabel(null)).toBe(true);
    expect(isDefaultSessionLabel("meu nome")).toBe(false);
    expect(isDefaultSessionLabel("Session extra")).toBe(false);
  });
});

describe("deriveSessionLabel", () => {
  it("uses the bare slash command plus its argument", () => {
    expect(deriveSessionLabel("/harness-cmd:task CRED-123 arruma login")).toBe(
      "task CRED-123 arruma login",
    );
    expect(deriveSessionLabel("/compact")).toBe("compact");
  });

  it("truncates long prose on a word boundary with an ellipsis", () => {
    const label = deriveSessionLabel(
      "corrige o bug do checkout que trava quando o usuário digita rápido demais no formulário",
    )!;
    expect(label.length).toBeLessThanOrEqual(43);
    expect(label.endsWith("…")).toBe(true);
    expect(label.startsWith("corrige o bug do checkout")).toBe(true);
  });

  it("uses only the first line and returns null for empty/short input", () => {
    expect(deriveSessionLabel("olha esse arquivo\ncom mais contexto")).toBe("olha esse arquivo");
    expect(deriveSessionLabel("")).toBeNull();
    expect(deriveSessionLabel("  \n\n")).toBeNull();
    expect(deriveSessionLabel("ok")).toBeNull();
  });
});

// ─── SET_ACTIVE tiling ───────────────────────────────────────────────

function makeSession(id: string): SessionData {
  return {
    id,
    label: id,
    color: "",
    group: null,
    phase: "idle",
    working_directory: "/x",
    shell: "zsh",
    created_at: "",
    last_activity_at: "",
    workspace_paths: [],
    detected_agent: null,
    metrics: {
      output_lines: 0, error_count: 0, stuck_score: 0, token_usage: {},
      tool_calls: [], tool_call_summary: {}, files_touched: [], recent_errors: [],
      recent_actions: [], available_actions: [], memory_facts: [],
      latency_p50_ms: null, latency_p95_ms: null, latency_samples: [], token_history: [],
    },
    ai_provider: null,
    context_injected: false,
  } as SessionData;
}

describe("SET_ACTIVE tiles pane-less sessions beside the layout", () => {
  it("activating a session with no pane appends it instead of swapping", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession("s1") });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession("s2") });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s1" });

    state = sessionReducer(state, { type: "SET_ACTIVE", id: "s2" });

    const panes = collectPanes(state.layout.root!);
    // s1 stays visible; s2 opens beside it
    expect(panes.map((p) => p.sessionId)).toEqual(["s1", "s2"]);
    expect(state.activeSessionId).toBe("s2");
  });

  it("activating a session that already has a pane just focuses it", () => {
    let state = initialState;
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession("s1") });
    state = sessionReducer(state, { type: "SESSION_UPDATED", session: makeSession("s2") });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s1" });
    state = sessionReducer(state, { type: "APPEND_PANE", sessionId: "s2" });
    const before = collectPanes(state.layout.root!).length;

    state = sessionReducer(state, { type: "SET_ACTIVE", id: "s1" });

    expect(collectPanes(state.layout.root!).length).toBe(before);
    expect(state.activeSessionId).toBe("s1");
  });
});
