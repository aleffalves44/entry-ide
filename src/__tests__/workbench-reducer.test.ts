/**
 * Reducer-level coverage for the right-rail Workbench (1.1.14).
 *
 * Pins:
 *   - default initial state matches the user-visible "open by default,
 *     50/50, files tab, files-take-70%" contract
 *   - each action mutates only the slice it owns and is reference-stable
 *     when it would no-op (so memoised consumers don't re-render)
 *   - SESSION_REMOVED prunes that session's note (saved_workspace
 *     hygiene)
 *   - RESTORE_WORKBENCH wholesale-replaces the slice from a parsed
 *     saved_workspace blob
 *
 * Pure reducer + initialState only — no rendering.
 */
import { describe, it, expect } from "vitest";
import { sessionReducer, initialState } from "../state/SessionContext";
import type { SessionAction, SessionData } from "../types/session";
import {
  DEFAULT_WORKBENCH_RATIO,
  DEFAULT_FILES_NOTES_SPLIT,
  MIN_WORKBENCH_RATIO,
  MAX_WORKBENCH_RATIO,
  NOTES_MAX_LEN,
} from "../utils/workbenchLayout";

// Minimal stub session — the reducer only reads .id / .phase / etc.
// for SESSION_UPDATED equality and id-keyed lookups in our cases.
function stubSession(id: string): SessionData {
  return {
    id,
    label: id,
    phase: "idle",
    color: "",
    description: "",
    group: null,
    last_activity_at: 0,
    working_directory: "",
    ai_provider: null,
    auto_approve: false,
    permission_mode: "default",
    custom_prefix: "",
    custom_suffix: "",
    project_ids: [],
    workspace_paths: [],
    ssh_info: null,
    mode: "agent",
    context_injected: false,
    detected_agent: null,
    metrics: { output_lines: 0, tool_calls: [], files_touched: [], memory_facts: [] },
  } as unknown as SessionData;
}

describe("Workbench reducer · initial state", () => {
  it("starts CLOSED (deselected) with files tab, 50/50 ratio, 70% files split", () => {
    expect(initialState.ui.workbench).toEqual({
      open: false,
      tab: "files",
      ratio: DEFAULT_WORKBENCH_RATIO,
      filesNotesSplit: DEFAULT_FILES_NOTES_SPLIT,
    });
  });
  it("starts with no notes", () => {
    expect(initialState.notes).toEqual({});
  });
});

describe("Workbench reducer · TOGGLE_WORKBENCH", () => {
  it("flips the open flag", () => {
    const next = sessionReducer(initialState, { type: "TOGGLE_WORKBENCH" });
    expect(next.ui.workbench.open).toBe(true);
    const back = sessionReducer(next, { type: "TOGGLE_WORKBENCH" });
    expect(back.ui.workbench.open).toBe(false);
  });
  it("does not touch tab / ratio / split when toggling", () => {
    const next = sessionReducer(initialState, { type: "TOGGLE_WORKBENCH" });
    expect(next.ui.workbench.tab).toBe(initialState.ui.workbench.tab);
    expect(next.ui.workbench.ratio).toBe(initialState.ui.workbench.ratio);
    expect(next.ui.workbench.filesNotesSplit).toBe(initialState.ui.workbench.filesNotesSplit);
  });
});

describe("Workbench reducer · SET_WORKBENCH_OPEN", () => {
  it("sets to true when currently false", () => {
    const reopened = sessionReducer(initialState, { type: "SET_WORKBENCH_OPEN", open: true });
    expect(reopened.ui.workbench.open).toBe(true);
  });
  it("returns the same reference when value matches (no-op)", () => {
    // Reference-equality check so consumers using useSyncExternalStore
    // don't re-render on a redundant set.
    const next = sessionReducer(initialState, { type: "SET_WORKBENCH_OPEN", open: false });
    expect(next).toBe(initialState);
  });
});

describe("Workbench reducer · SET_WORKBENCH_TAB", () => {
  it("switches tab to context", () => {
    const next = sessionReducer(initialState, { type: "SET_WORKBENCH_TAB", tab: "context" });
    expect(next.ui.workbench.tab).toBe("context");
  });
  it("returns the same state reference on a no-op", () => {
    const next = sessionReducer(initialState, { type: "SET_WORKBENCH_TAB", tab: "files" });
    expect(next).toBe(initialState);
  });
});

describe("Workbench reducer · SET_WORKBENCH_RATIO", () => {
  it("clamps below the minimum", () => {
    const next = sessionReducer(initialState, { type: "SET_WORKBENCH_RATIO", ratio: 0.01 });
    expect(next.ui.workbench.ratio).toBe(MIN_WORKBENCH_RATIO);
  });
  it("clamps above the maximum", () => {
    const next = sessionReducer(initialState, { type: "SET_WORKBENCH_RATIO", ratio: 0.99 });
    expect(next.ui.workbench.ratio).toBe(MAX_WORKBENCH_RATIO);
  });
  it("passes through valid ratio", () => {
    const next = sessionReducer(initialState, { type: "SET_WORKBENCH_RATIO", ratio: 0.4 });
    expect(next.ui.workbench.ratio).toBe(0.4);
  });
});

describe("Workbench reducer · SET_WORKBENCH_FILES_NOTES_SPLIT", () => {
  it("clamps and mutates the split", () => {
    const next = sessionReducer(initialState, {
      type: "SET_WORKBENCH_FILES_NOTES_SPLIT",
      ratio: 0.55,
    });
    expect(next.ui.workbench.filesNotesSplit).toBe(0.55);
  });
});

describe("Workbench reducer · SET_SESSION_NOTE", () => {
  it("stores the note under the session id", () => {
    const next = sessionReducer(initialState, {
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: "remember: refactor auth",
    });
    expect(next.notes["s1"]).toBe("remember: refactor auth");
  });

  it("truncates oversized content (NOTES_MAX_LEN)", () => {
    const big = "a".repeat(NOTES_MAX_LEN + 100);
    const next = sessionReducer(initialState, {
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: big,
    });
    expect(next.notes["s1"]?.length).toBe(NOTES_MAX_LEN);
  });

  it("returns the same state reference when content is unchanged", () => {
    const seeded = sessionReducer(initialState, {
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: "hello",
    });
    const noop = sessionReducer(seeded, {
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: "hello",
    });
    expect(noop).toBe(seeded);
  });

  it("does not interfere with other sessions' notes", () => {
    const a = sessionReducer(initialState, {
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: "note for s1",
    });
    const b = sessionReducer(a, {
      type: "SET_SESSION_NOTE",
      sessionId: "s2",
      content: "note for s2",
    });
    expect(b.notes["s1"]).toBe("note for s1");
    expect(b.notes["s2"]).toBe("note for s2");
  });
});

describe("Workbench reducer · SESSION_REMOVED prunes notes", () => {
  it("drops the closed session's note", () => {
    // Seed a session + a note for it.
    const session = stubSession("s1");
    const withSession = sessionReducer(initialState, {
      type: "SESSION_UPDATED",
      session,
    });
    const withNote = sessionReducer(withSession, {
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: "do not lose me on close",
    });
    expect(withNote.notes["s1"]).toBeDefined();

    // Closing the session must delete the note slot.
    const removed = sessionReducer(withNote, {
      type: "SESSION_REMOVED",
      id: "s1",
    });
    expect(removed.notes["s1"]).toBeUndefined();
  });

  it("preserves notes for sessions other than the one removed", () => {
    const s1 = stubSession("s1");
    const s2 = stubSession("s2");
    let st = sessionReducer(initialState, { type: "SESSION_UPDATED", session: s1 });
    st = sessionReducer(st, { type: "SESSION_UPDATED", session: s2 });
    st = sessionReducer(st, { type: "SET_SESSION_NOTE", sessionId: "s1", content: "n1" });
    st = sessionReducer(st, { type: "SET_SESSION_NOTE", sessionId: "s2", content: "n2" });
    const removed = sessionReducer(st, { type: "SESSION_REMOVED", id: "s1" });
    expect(removed.notes["s1"]).toBeUndefined();
    expect(removed.notes["s2"]).toBe("n2");
  });
});

describe("Workbench reducer · RESTORE_WORKBENCH", () => {
  it("replaces both the panel layout and the notes map", () => {
    const restored = sessionReducer(initialState, {
      type: "RESTORE_WORKBENCH",
      layout: { open: false, tab: "context", ratio: 0.4, filesNotesSplit: 0.6 },
      notes: { "s1": "loaded from disk" },
    });
    expect(restored.ui.workbench).toEqual({
      open: false,
      tab: "context",
      ratio: 0.4,
      filesNotesSplit: 0.6,
    });
    expect(restored.notes).toEqual({ "s1": "loaded from disk" });
  });

  it("clamps numeric fields on restore (defends against hand-edited workspace files)", () => {
    const restored = sessionReducer(initialState, {
      type: "RESTORE_WORKBENCH",
      layout: { open: true, tab: "files", ratio: 99, filesNotesSplit: -1 },
      notes: {},
    });
    expect(restored.ui.workbench.ratio).toBeLessThanOrEqual(MAX_WORKBENCH_RATIO);
    expect(restored.ui.workbench.filesNotesSplit).toBeGreaterThanOrEqual(0);
  });
});

// Type-only smoke check: the workbench actions are part of SessionAction.
// If the new variants are accidentally dropped from the union, this fails to compile.
const _typeCheck: SessionAction[] = [
  { type: "TOGGLE_WORKBENCH" },
  { type: "SET_WORKBENCH_OPEN", open: true },
  { type: "SET_WORKBENCH_TAB", tab: "files" },
  { type: "SET_WORKBENCH_RATIO", ratio: 0.5 },
  { type: "SET_WORKBENCH_FILES_NOTES_SPLIT", ratio: 0.7 },
  { type: "SET_SESSION_NOTE", sessionId: "s1", content: "" },
];
void _typeCheck;
