/**
 * Pure-helper coverage for the right-rail Workbench (v1.1.14).
 *
 * Persistence is stored in saved_workspace.json, so anything the
 * loader/serializer do here must round-trip without surprise.  These
 * tests pin: clamp boundaries, default fallback on malformed input,
 * and lossless round-trip for the well-formed case.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_WORKBENCH_RATIO,
  MIN_WORKBENCH_RATIO,
  MAX_WORKBENCH_RATIO,
  DEFAULT_FILES_NOTES_SPLIT,
  MIN_FILES_NOTES_SPLIT,
  MAX_FILES_NOTES_SPLIT,
  DEFAULT_PERSISTED_WORKBENCH,
  NOTES_MAX_LEN,
  MIN_CHAT_WIDTH_PX,
  MIN_WORKBENCH_WIDTH_PX,
  clampWorkbenchRatio,
  clampFilesNotesSplit,
  clampNoteContent,
  workbenchPixelWidth,
  loadWorkbenchLayout,
  serializeWorkbenchLayout,
  loadNotesMap,
  serializeNotesMap,
  isWorkbenchTab,
} from "../utils/workbenchLayout";

describe("workbenchLayout · clampWorkbenchRatio", () => {
  it("clamps below the minimum to the minimum", () => {
    expect(clampWorkbenchRatio(0.05)).toBe(MIN_WORKBENCH_RATIO);
  });
  it("clamps above the maximum to the maximum", () => {
    expect(clampWorkbenchRatio(0.95)).toBe(MAX_WORKBENCH_RATIO);
  });
  it("returns the default for non-finite inputs", () => {
    expect(clampWorkbenchRatio(NaN)).toBe(DEFAULT_WORKBENCH_RATIO);
    expect(clampWorkbenchRatio(Infinity)).toBe(DEFAULT_WORKBENCH_RATIO);
  });
  it("passes through valid values unchanged", () => {
    expect(clampWorkbenchRatio(0.5)).toBe(0.5);
    expect(clampWorkbenchRatio(0.3)).toBe(0.3);
  });
});

describe("workbenchLayout · clampFilesNotesSplit", () => {
  it("clamps to [MIN, MAX]", () => {
    expect(clampFilesNotesSplit(0.05)).toBe(MIN_FILES_NOTES_SPLIT);
    expect(clampFilesNotesSplit(0.99)).toBe(MAX_FILES_NOTES_SPLIT);
  });
  it("returns the default for NaN / Infinity", () => {
    expect(clampFilesNotesSplit(NaN)).toBe(DEFAULT_FILES_NOTES_SPLIT);
  });
  it("passes through valid values", () => {
    expect(clampFilesNotesSplit(0.7)).toBe(0.7);
    expect(clampFilesNotesSplit(0.5)).toBe(0.5);
  });
});

describe("workbenchLayout · workbenchPixelWidth", () => {
  it("returns the configured ratio for normal viewports", () => {
    // 1600px viewport, 0.5 ratio => 800px workbench
    expect(workbenchPixelWidth(1600, 0.5)).toBe(800);
  });
  it("never lets the chat shrink below MIN_CHAT_WIDTH_PX", () => {
    // 600px viewport, 0.7 ratio would give 420px to workbench, leaving
    // 180px for the chat.  The clamp must reduce the workbench so the
    // chat keeps at least MIN_CHAT_WIDTH_PX.
    const w = workbenchPixelWidth(600, 0.7);
    expect(600 - w).toBeGreaterThanOrEqual(MIN_CHAT_WIDTH_PX);
  });
  it("respects the workbench floor at very narrow viewports", () => {
    // Even when viewport - chat-floor is below the workbench floor,
    // we keep the workbench at MIN_WORKBENCH_WIDTH_PX rather than
    // collapsing it (the user can close it explicitly via the toggle).
    const w = workbenchPixelWidth(400, 0.5);
    expect(w).toBeGreaterThanOrEqual(MIN_WORKBENCH_WIDTH_PX);
  });
});

describe("workbenchLayout · clampNoteContent", () => {
  it("returns short strings unchanged", () => {
    expect(clampNoteContent("hello world")).toBe("hello world");
  });
  it("truncates strings longer than NOTES_MAX_LEN", () => {
    const big = "a".repeat(NOTES_MAX_LEN + 100);
    const out = clampNoteContent(big);
    expect(out.length).toBe(NOTES_MAX_LEN);
  });
  it("returns empty string for non-string input", () => {
    expect(clampNoteContent(null as unknown as string)).toBe("");
    expect(clampNoteContent(undefined as unknown as string)).toBe("");
    expect(clampNoteContent(42 as unknown as string)).toBe("");
  });
});

describe("workbenchLayout · loadWorkbenchLayout", () => {
  it("returns defaults when input is null / undefined / non-object", () => {
    expect(loadWorkbenchLayout(null)).toEqual(DEFAULT_PERSISTED_WORKBENCH);
    expect(loadWorkbenchLayout(undefined)).toEqual(DEFAULT_PERSISTED_WORKBENCH);
    expect(loadWorkbenchLayout("not an object")).toEqual(DEFAULT_PERSISTED_WORKBENCH);
  });
  it("parses a fully-specified valid blob", () => {
    const raw = { open: false, tab: "context", ratio: 0.4, filesNotesSplit: 0.6 };
    expect(loadWorkbenchLayout(raw)).toEqual({
      open: false,
      tab: "context",
      ratio: 0.4,
      filesNotesSplit: 0.6,
    });
  });
  it("falls back per-field on malformed values", () => {
    const raw = { open: "yes", tab: "garbage", ratio: NaN, filesNotesSplit: "0.5" };
    const loaded = loadWorkbenchLayout(raw);
    expect(loaded.open).toBe(DEFAULT_PERSISTED_WORKBENCH.open);
    expect(loaded.tab).toBe(DEFAULT_PERSISTED_WORKBENCH.tab);
    expect(loaded.ratio).toBe(DEFAULT_WORKBENCH_RATIO);
    expect(loaded.filesNotesSplit).toBe(DEFAULT_FILES_NOTES_SPLIT);
  });
  it("clamps out-of-range numeric values into the allowed band", () => {
    const raw = { open: true, tab: "files", ratio: 0.99, filesNotesSplit: 0.01 };
    const loaded = loadWorkbenchLayout(raw);
    expect(loaded.ratio).toBe(MAX_WORKBENCH_RATIO);
    expect(loaded.filesNotesSplit).toBe(MIN_FILES_NOTES_SPLIT);
  });
});

describe("workbenchLayout · serializeWorkbenchLayout (round-trip)", () => {
  it("round-trips a well-formed layout without loss", () => {
    const layout = { open: true, tab: "files" as const, ratio: 0.5, filesNotesSplit: 0.7 };
    const serialised = serializeWorkbenchLayout(layout);
    expect(loadWorkbenchLayout(serialised)).toEqual(layout);
  });
});

describe("workbenchLayout · loadNotesMap / serializeNotesMap", () => {
  it("loads only string-valued, non-empty-keyed entries", () => {
    const raw = {
      "s1": "hello",
      "s2": "",
      "s3": 42, // dropped
      "": "should drop", // dropped — empty key
    };
    const out = loadNotesMap(raw);
    expect(out["s1"]).toBe("hello");
    expect(out["s2"]).toBe("");
    expect(out["s3"]).toBeUndefined();
    expect(out[""]).toBeUndefined();
  });
  it("returns an empty record for non-object input", () => {
    expect(loadNotesMap(null)).toEqual({});
    expect(loadNotesMap("string")).toEqual({});
    expect(loadNotesMap([])).toEqual({});
  });
  it("serializeNotesMap drops empty strings (no dead keys)", () => {
    const notes = { "s1": "kept", "s2": "", "s3": "also-kept" };
    const out = serializeNotesMap(notes);
    expect(out).toEqual({ "s1": "kept", "s3": "also-kept" });
  });
  it("truncates oversized notes on load", () => {
    const big = "x".repeat(NOTES_MAX_LEN + 10);
    const loaded = loadNotesMap({ "s1": big });
    expect(loaded["s1"]?.length).toBe(NOTES_MAX_LEN);
  });
});

describe("workbenchLayout · isWorkbenchTab", () => {
  it("recognises valid tabs", () => {
    expect(isWorkbenchTab("files")).toBe(true);
    expect(isWorkbenchTab("context")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isWorkbenchTab("notes")).toBe(false);
    expect(isWorkbenchTab("")).toBe(false);
    expect(isWorkbenchTab(undefined)).toBe(false);
    expect(isWorkbenchTab(42)).toBe(false);
  });
});
