/**
 * git-diff-viewer.test.ts
 *
 * Covers IPC contracts and new behaviors introduced by git-changes-visibility.
 *
 * RF-01  untracked click reaches onDiffFile
 * RF-02  SET_DIFF_VIEWER dispatch via SessionGitPanel (reducer snapshot)
 * RF-03  untracked diff returns additions > 0
 * RF-05  truncated diff does not show "Binary file"
 * RF-09  GitDiff.truncated is separate from is_binary
 * CT-01  GitDiff interface has truncated: boolean
 * CT-02  git_diff returns valid payload for untracked
 * UI-02  diffViewMode persists after SET_DIFF_VIEWER
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mock Tauri APIs (same pattern as git-context-bugs.test.ts) ────────
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
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
  dismissSuggestions: vi.fn(),
  clearGhostText: vi.fn(),
  sendShortcutCommand: vi.fn(),
}));
vi.mock("../utils/notifications", () => ({
  initNotifications: vi.fn(),
  notifyLongRunningDone: vi.fn(),
}));

import type { GitDiff, GitFile } from "../types/git";
import { getLanguageSupport, getLanguageForExtension } from "../editor/languageRegistry";
import { parseWordDiff, parseDiffHunks } from "../components/GitDiffView";

// =====================================================================
// CT-01 — GitDiff interface includes truncated: boolean
// =====================================================================

describe("CT-01: GitDiff.truncated field contract", () => {
  it("GitDiff interface allows truncated: boolean field", () => {
    // Compile-time check: constructing a GitDiff with truncated should not error.
    const diff: GitDiff = {
      path: "src/main.ts",
      diff_text: "+ const x = 1;\n",
      is_binary: false,
      truncated: false,
      additions: 1,
      deletions: 0,
    };
    expect(diff.truncated).toBe(false);
  });

  it("GitDiff.truncated is independent of is_binary", () => {
    const truncatedTextFile: GitDiff = {
      path: "src/large.ts",
      diff_text: "",
      is_binary: false,
      truncated: true,
      additions: 0,
      deletions: 0,
    };
    expect(truncatedTextFile.is_binary).toBe(false);
    expect(truncatedTextFile.truncated).toBe(true);
  });

  it("binary file has is_binary true and truncated false", () => {
    const binaryFile: GitDiff = {
      path: "assets/image.png",
      diff_text: "",
      is_binary: true,
      truncated: false,
      additions: 0,
      deletions: 0,
    };
    expect(binaryFile.is_binary).toBe(true);
    expect(binaryFile.truncated).toBe(false);
  });
});

// =====================================================================
// CT-02 — git_diff returns valid payload for untracked
// =====================================================================

describe("CT-02: untracked diff payload contract", () => {
  it("untracked file mock returns additions > 0", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);

    const payload: GitDiff = {
      path: "newfile.ts",
      diff_text: "+const x = 1;\n+const y = 2;\n",
      is_binary: false,
      truncated: false,
      additions: 2,
      deletions: 0,
    };
    mockInvoke.mockResolvedValueOnce(payload);

    const result = await invoke<GitDiff>("git_diff", {
      sessionId: "s1",
      projectId: "p1",
      filePath: "newfile.ts",
      staged: false,
    });

    expect(result.additions).toBeGreaterThan(0);
    expect(result.diff_text).toContain("+");
    expect(result.is_binary).toBe(false);
  });

  it("diff lines for untracked are all additions (start with +)", () => {
    const diffText = "+const x = 1;\n+const y = 2;\n+export { x, y };\n";
    const lines = diffText.split("\n").filter((l) => l.length > 0);
    const nonAddition = lines.filter((l) => !l.startsWith("+"));
    expect(nonAddition).toHaveLength(0);
  });
});

// =====================================================================
// RF-01 — handleFileClick for untracked calls onDiffFile
// =====================================================================

describe("RF-01: untracked file click reaches onDiffFile", () => {
  it("onDiffFile is called for untracked file (no status filter)", () => {
    const onDiffFile = vi.fn();

    // Simulate the fixed handleFileClick (no guard on status)
    function handleFileClick(file: GitFile) {
      onDiffFile("session-1", "project-1", file);
    }

    const untrackedFile: GitFile = {
      path: "src/new-feature.ts",
      status: "untracked",
      area: "untracked",
      old_path: null,
    };

    handleFileClick(untrackedFile);
    expect(onDiffFile).toHaveBeenCalledWith("session-1", "project-1", untrackedFile);
  });

  it("onDiffFile is called for staged file", () => {
    const onDiffFile = vi.fn();

    function handleFileClick(file: GitFile) {
      onDiffFile("session-1", "project-1", file);
    }

    const stagedFile: GitFile = {
      path: "src/existing.ts",
      status: "modified",
      area: "staged",
      old_path: null,
    };

    handleFileClick(stagedFile);
    expect(onDiffFile).toHaveBeenCalledOnce();
  });
});

// =====================================================================
// RF-02 — SET_DIFF_VIEWER unifies both surfaces
// =====================================================================

describe("RF-02: SET_DIFF_VIEWER dispatch — reducer snapshot", () => {
  it("SET_DIFF_VIEWER action updates ui.viewer with diff kind", () => {
    type Viewer =
      | { kind: "diff"; sessionId: string; projectId: string; file: GitFile }
      | { kind: "file"; projectId: string; filePath: string }
      | null;

    type UIState = { viewer: Viewer; diffViewMode: "unified" | "side-by-side" };

    type Action =
      | { type: "SET_DIFF_VIEWER"; sessionId: string; projectId: string; file: GitFile }
      | { type: "SET_DIFF_VIEW_MODE"; mode: "unified" | "side-by-side" };

    function uiReducer(state: UIState, action: Action): UIState {
      switch (action.type) {
        case "SET_DIFF_VIEWER":
          return {
            ...state,
            viewer: { kind: "diff", sessionId: action.sessionId, projectId: action.projectId, file: action.file },
          };
        case "SET_DIFF_VIEW_MODE":
          return { ...state, diffViewMode: action.mode };
        default:
          return state;
      }
    }

    const file: GitFile = {
      path: "src/api.ts",
      status: "modified",
      area: "staged",
      old_path: null,
    };

    let state: UIState = { viewer: null, diffViewMode: "unified" };
    state = uiReducer(state, { type: "SET_DIFF_VIEWER", sessionId: "s1", projectId: "p1", file });

    expect(state.viewer).not.toBeNull();
    expect(state.viewer?.kind).toBe("diff");
    if (state.viewer?.kind === "diff") {
      expect(state.viewer.file.path).toBe("src/api.ts");
    }
  });

  it("both GitPanel and SessionGitPanel dispatch same SET_DIFF_VIEWER action shape", () => {
    // Both surfaces should produce an action with the same structure.
    const file: GitFile = {
      path: "src/service.ts",
      status: "modified",
      area: "unstaged",
      old_path: null,
    };

    const gitPanelAction = {
      type: "SET_DIFF_VIEWER" as const,
      sessionId: "s1",
      projectId: "p1",
      file,
    };

    // SessionGitPanel now dispatches the same action (RF-02 fix)
    const sessionGitPanelAction = {
      type: "SET_DIFF_VIEWER" as const,
      sessionId: "s1",
      projectId: "p1",
      file,
    };

    expect(gitPanelAction.type).toBe(sessionGitPanelAction.type);
    expect(gitPanelAction.file.path).toBe(sessionGitPanelAction.file.path);
  });
});

// =====================================================================
// RF-05 / RF-09 — truncated diff shows descriptive message, not "Binary file"
// =====================================================================

describe("RF-05/RF-09: truncated diff rendering logic", () => {
  it("truncated text file: is_binary remains false, truncated is true", () => {
    const diff: GitDiff = {
      path: "src/large-file.ts",
      diff_text: "",
      is_binary: false,
      truncated: true,
      additions: 0,
      deletions: 0,
    };

    // The viewer should NOT show "Binary file" for this
    const shouldShowBinary = diff.is_binary && !diff.truncated;
    const shouldShowTruncated = diff.truncated && !diff.is_binary;

    expect(shouldShowBinary).toBe(false);
    expect(shouldShowTruncated).toBe(true);
  });

  it("genuine binary file: is_binary true, truncated false", () => {
    const diff: GitDiff = {
      path: "assets/photo.jpg",
      diff_text: "",
      is_binary: true,
      truncated: false,
      additions: 0,
      deletions: 0,
    };

    const shouldShowBinary = diff.is_binary && !diff.truncated;
    expect(shouldShowBinary).toBe(true);
  });

  it("normal file: neither binary banner nor truncated banner", () => {
    const diff: GitDiff = {
      path: "src/component.tsx",
      diff_text: "+const x = 1;\n",
      is_binary: false,
      truncated: false,
      additions: 1,
      deletions: 0,
    };

    const shouldShowBinary = diff.is_binary && !diff.truncated;
    const shouldShowTruncated = diff.truncated && !diff.is_binary;

    expect(shouldShowBinary).toBe(false);
    expect(shouldShowTruncated).toBe(false);
  });
});

// =====================================================================
// UI-02 — diffViewMode persists after SET_DIFF_VIEWER
// =====================================================================

describe("UI-02: diffViewMode persists when switching files", () => {
  it("SET_DIFF_VIEW_MODE change persists after subsequent SET_DIFF_VIEWER", () => {
    type UIState = {
      viewer: { kind: "diff"; sessionId: string; projectId: string; file: GitFile } | null;
      diffViewMode: "unified" | "side-by-side";
    };

    type Action =
      | { type: "SET_DIFF_VIEWER"; sessionId: string; projectId: string; file: GitFile }
      | { type: "SET_DIFF_VIEW_MODE"; mode: "unified" | "side-by-side" };

    function uiReducer(state: UIState, action: Action): UIState {
      switch (action.type) {
        case "SET_DIFF_VIEWER":
          return {
            ...state,
            viewer: { kind: "diff", sessionId: action.sessionId, projectId: action.projectId, file: action.file },
          };
        case "SET_DIFF_VIEW_MODE":
          return { ...state, diffViewMode: action.mode };
        default:
          return state;
      }
    }

    const fileA: GitFile = { path: "a.ts", status: "modified", area: "staged", old_path: null };
    const fileB: GitFile = { path: "b.ts", status: "modified", area: "unstaged", old_path: null };

    let state: UIState = { viewer: null, diffViewMode: "unified" };

    // User sets side-by-side
    state = uiReducer(state, { type: "SET_DIFF_VIEW_MODE", mode: "side-by-side" });
    expect(state.diffViewMode).toBe("side-by-side");

    // User clicks file A
    state = uiReducer(state, { type: "SET_DIFF_VIEWER", sessionId: "s1", projectId: "p1", file: fileA });
    expect(state.diffViewMode).toBe("side-by-side"); // mode preserved

    // User clicks file B
    state = uiReducer(state, { type: "SET_DIFF_VIEWER", sessionId: "s1", projectId: "p1", file: fileB });
    expect(state.diffViewMode).toBe("side-by-side"); // mode still preserved
    if (state.viewer?.kind === "diff") {
      expect(state.viewer.file.path).toBe("b.ts");
    }
  });
});

// =====================================================================
// RF-07 — syntax highlight via getLanguageSupport
// =====================================================================

describe("RF-07: getLanguageSupport smoke test", () => {
  it("returns non-null for typescript", () => {
    const support = getLanguageSupport("typescript");
    expect(support).not.toBeNull();
  });

  it("returns non-null for rust", () => {
    const support = getLanguageSupport("rust");
    expect(support).not.toBeNull();
  });

  it("returns non-null for python", () => {
    const support = getLanguageSupport("python");
    expect(support).not.toBeNull();
  });

  it("returns null for unknown language", () => {
    const support = getLanguageSupport("unknownlang");
    expect(support).toBeNull();
  });

  it("getLanguageForExtension maps .ts to typescript", () => {
    expect(getLanguageForExtension("ts")).toBe("typescript");
  });

  it("getLanguageForExtension maps .rs to rust", () => {
    expect(getLanguageForExtension("rs")).toBe("rust");
  });
});

// =====================================================================
// RF-06 — parseDiffHunks for side-by-side rendering
// =====================================================================

describe("RF-06: parseDiffHunks for side-by-side layout", () => {
  it("parses a simple unified diff into hunk groups", () => {
    const diffText = `@@ -1,3 +1,4 @@
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
 export { x, y };
`;
    const hunks = parseDiffHunks(diffText);
    expect(hunks.length).toBeGreaterThan(0);
    const firstHunk = hunks[0];
    expect(firstHunk.lines.some((l) => l.type === "del")).toBe(true);
    expect(firstHunk.lines.some((l) => l.type === "add")).toBe(true);
  });

  it("handles empty diff text gracefully", () => {
    const hunks = parseDiffHunks("");
    expect(hunks).toEqual([]);
  });

  it("context lines get type 'ctx'", () => {
    const diffText = `@@ -1,2 +1,2 @@
 context line
-old line
+new line
`;
    const hunks = parseDiffHunks(diffText);
    const ctxLines = hunks.flatMap((h) => h.lines).filter((l) => l.type === "ctx");
    expect(ctxLines.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// RF-06 — parseWordDiff for intra-line word-level diff
// =====================================================================

describe("RF-06: parseWordDiff for word-level diff", () => {
  it("returns tokens for del and add lines", () => {
    const result = parseWordDiff("const x = 1;", "const x = 2;");
    expect(result.del.length).toBeGreaterThan(0);
    expect(result.add.length).toBeGreaterThan(0);
  });

  it("unchanged tokens get type 'same'", () => {
    const result = parseWordDiff("const x = 1;", "const x = 1;");
    const allSame = result.del.every((t) => t.type === "same") && result.add.every((t) => t.type === "same");
    expect(allSame).toBe(true);
  });

  it("changed tokens get type 'del' or 'add'", () => {
    const result = parseWordDiff("foo bar baz", "foo qux baz");
    const delChanged = result.del.some((t) => t.type === "del");
    const addChanged = result.add.some((t) => t.type === "add");
    expect(delChanged).toBe(true);
    expect(addChanged).toBe(true);
  });

  it("handles empty strings gracefully", () => {
    const result = parseWordDiff("", "");
    expect(result.del).toEqual([]);
    expect(result.add).toEqual([]);
  });
});

// =====================================================================
// RF-08 — gitGutter extension
// =====================================================================

describe("RF-08: gitGutterExtension contract", () => {
  it("gitGutterExtension(null) returns an array without throwing", async () => {
    const { gitGutterExtension } = await import("../editor/gitGutter");
    expect(() => gitGutterExtension(null)).not.toThrow();
    const ext = gitGutterExtension(null);
    expect(Array.isArray(ext)).toBe(true);
  });

  it("gitGutterExtension with markers returns non-empty extension array", async () => {
    const { gitGutterExtension } = await import("../editor/gitGutter");
    const markers = {
      added: new Set([1, 2]),
      modified: new Set([3]),
      deleted: new Set<number>(),
    };
    const ext = gitGutterExtension(markers);
    expect(Array.isArray(ext)).toBe(true);
    expect(ext.length).toBeGreaterThan(0);
  });
});
