// @vitest-environment jsdom
/**
 * Bug 2 regression tests for `SessionBranchSelector`.
 *
 * Symptom (1.2.x agent-mode rollout):
 *   The user expands a project in the SessionCreator's branch step, sees
 *   the branch list, and clicks the project-list-level "Continue" button.
 *   They never click the per-selector "Use Branch" button — so
 *   `onBranchSelected` never fires, the parent's `branchSelections` stays
 *   empty, `createSession` is called WITHOUT branch info, no worktree is
 *   created, and the agent boots on whatever branch the project happened
 *   to be on.  The selection looks like it was applied (UI shows the
 *   branch as "current") but in reality nothing was propagated to the
 *   parent.
 *
 * Fix:
 *   `SessionBranchSelector` propagates the current branch to the parent
 *   automatically on initial load (`onBranchSelected(current.name, false)`)
 *   so the parent's `branchSelections` is populated even when the user
 *   does nothing inside the selector.  Users who want a different branch
 *   click a row and "Use Branch" exactly like before — that call simply
 *   overwrites the auto-propagated entry.
 *
 * Edge cases covered:
 *   - The current branch is already in use by another worktree → do NOT
 *     auto-propagate (the user must explicitly choose another branch).
 *   - No current branch (detached HEAD, fresh repo) → no propagation.
 *   - The propagation must fire only once per render (idempotency).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

import { invoke } from "@tauri-apps/api/core";
import { SessionBranchSelector } from "../components/SessionBranchSelector";

interface MockBranch {
  name: string;
  is_remote: boolean;
  is_current: boolean;
  last_commit_summary: string | null;
}

function mockBackend(branches: MockBranch[], worktrees: Array<{ branchName: string; sessionId: string }> = []) {
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case "git_list_branches_for_project":
        return branches;
      case "git_list_worktrees":
        return worktrees;
      default:
        return undefined;
    }
  });
}

describe("Bug 2 — SessionBranchSelector auto-propagates the current branch", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(invoke).mockReset();
  });

  it("fires onBranchSelected(current, false) once after the branch list loads", async () => {
    mockBackend([
      { name: "feature-x", is_remote: false, is_current: true, last_commit_summary: null },
      { name: "main", is_remote: false, is_current: false, last_commit_summary: null },
    ]);
    const onBranchSelected = vi.fn();
    render(
      <SessionBranchSelector
        projectId="p1"
        onBranchSelected={onBranchSelected}
        onSkip={() => {}}
      />,
    );

    await waitFor(() => {
      expect(onBranchSelected).toHaveBeenCalledWith("feature-x", false);
    });
    // Critical: propagation happens exactly once per render.  A loop or
    // a useEffect dependency mistake would call it on every render, and
    // we don't want to spam the parent with duplicate selections.
    expect(onBranchSelected).toHaveBeenCalledTimes(1);
  });

  it("does NOT auto-propagate when the current branch is already taken by another session", async () => {
    mockBackend(
      [{ name: "feature-x", is_remote: false, is_current: true, last_commit_summary: null }],
      [{ branchName: "feature-x", sessionId: "other-session" }],
    );
    const onBranchSelected = vi.fn();
    render(
      <SessionBranchSelector
        projectId="p1"
        onBranchSelected={onBranchSelected}
        onSkip={() => {}}
      />,
    );

    // Give effects time to fire.  We assert *negative* behaviour, so we
    // can't just waitFor — we wait a tick then check no calls.
    await new Promise((r) => setTimeout(r, 50));
    expect(onBranchSelected).not.toHaveBeenCalled();
  });

  it("does NOT auto-propagate when there is no current branch (detached HEAD / fresh repo)", async () => {
    mockBackend([
      { name: "main", is_remote: false, is_current: false, last_commit_summary: null },
      { name: "dev", is_remote: false, is_current: false, last_commit_summary: null },
    ]);
    const onBranchSelected = vi.fn();
    render(
      <SessionBranchSelector
        projectId="p1"
        onBranchSelected={onBranchSelected}
        onSkip={() => {}}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(onBranchSelected).not.toHaveBeenCalled();
  });

  it("ignores remote branches when picking the default", async () => {
    // A remote branch marked is_current (rare but legal in the SDK output)
    // is NOT a valid auto-pick: the local working tree isn't actually
    // checked out to a remote ref.
    mockBackend([
      { name: "origin/release", is_remote: true, is_current: true, last_commit_summary: null },
      { name: "main", is_remote: false, is_current: false, last_commit_summary: null },
    ]);
    const onBranchSelected = vi.fn();
    render(
      <SessionBranchSelector
        projectId="p1"
        onBranchSelected={onBranchSelected}
        onSkip={() => {}}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(onBranchSelected).not.toHaveBeenCalled();
  });

  it("'Use current branch' (onSkip) still clears the parent's selection", async () => {
    // Regression: the auto-propagate happens BEFORE onSkip can be called,
    // so the parent's branchSelections briefly has an entry.  Clicking
    // "Use current branch" must call onSkip so the parent can clear it
    // (the parent's onSkip handler in SessionCreator deletes the
    // branchSelections[projectId] entry).
    mockBackend([
      { name: "feature-x", is_remote: false, is_current: true, last_commit_summary: null },
    ]);
    const onSkip = vi.fn();
    const onBranchSelected = vi.fn();
    const { getByText } = render(
      <SessionBranchSelector
        projectId="p1"
        onBranchSelected={onBranchSelected}
        onSkip={onSkip}
      />,
    );

    await waitFor(() => {
      expect(onBranchSelected).toHaveBeenCalledWith("feature-x", false);
    });

    getByText("Use current branch").click();

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
