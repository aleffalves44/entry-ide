/**
 * Tests that getProjects() filters out worktree paths
 * (both current `entry-worktrees/` and legacy `.entry/worktrees/` formats).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Tauri APIs ─────────────────────────────────────────────────
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { getProjects, isWorktreePath } from "../api/projects";

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── isWorktreePath ──────────────────────────────────────────────────

describe("isWorktreePath", () => {
  it("detects current entry-worktrees/ format", () => {
    expect(
      isWorktreePath("/app/data/entry-worktrees/a1b2c3d4e5f6a7b8/abc_feature"),
    ).toBe(true);
  });

  it("detects legacy .entry/worktrees/ format", () => {
    expect(
      isWorktreePath("/Users/dev/playground/.entry/worktrees/c372d349_feature-123"),
    ).toBe(true);
  });

  it("returns false for normal project paths", () => {
    expect(isWorktreePath("/Users/dev/WebstormProjects/my-app")).toBe(false);
  });

  it("returns false for paths containing 'worktrees' outside entry context", () => {
    expect(isWorktreePath("/Users/dev/git-worktrees/my-project")).toBe(false);
  });

  it("detects nested worktree paths (subdirectories)", () => {
    expect(
      isWorktreePath("/app/data/entry-worktrees/hash/abc_main/src/index.ts"),
    ).toBe(true);
  });
});

// ─── getProjects filtering ───────────────────────────────────────────

describe("getProjects", () => {
  const normalProject = {
    id: "1",
    path: "/Users/dev/WebstormProjects/my-app",
    name: "my-app",
    languages: ["TypeScript"],
    frameworks: [],
    scan_status: "done",
    last_scanned_at: null,
    created_at: "",
    updated_at: "",
    architecture: null,
    conventions: [],
  };

  const currentWorktreeProject = {
    ...normalProject,
    id: "2",
    path: "/app/data/entry-worktrees/a1b2c3d4e5f6a7b8/abc12345_feature-login",
    name: "abc12345_feature-login",
  };

  const legacyWorktreeProject = {
    ...normalProject,
    id: "3",
    path: "/Users/dev/playground/.entry/worktrees/c372d349_feature-123",
    name: "c372d349_feature-123",
  };

  it("filters out current-format worktree projects", async () => {
    mockedInvoke.mockResolvedValue([normalProject, currentWorktreeProject]);

    const result = await getProjects();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters out legacy-format worktree projects", async () => {
    mockedInvoke.mockResolvedValue([normalProject, legacyWorktreeProject]);

    const result = await getProjects();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters out both formats in the same list", async () => {
    mockedInvoke.mockResolvedValue([
      normalProject,
      currentWorktreeProject,
      legacyWorktreeProject,
    ]);

    const result = await getProjects();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("my-app");
  });

  it("returns all projects when none are worktrees", async () => {
    const anotherProject = { ...normalProject, id: "4", name: "other-app" };
    mockedInvoke.mockResolvedValue([normalProject, anotherProject]);

    const result = await getProjects();
    expect(result).toHaveLength(2);
  });

  it("returns empty array when all projects are worktrees", async () => {
    mockedInvoke.mockResolvedValue([currentWorktreeProject, legacyWorktreeProject]);

    const result = await getProjects();
    expect(result).toHaveLength(0);
  });
});
