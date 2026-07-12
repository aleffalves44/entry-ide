// @vitest-environment jsdom
/**
 * QuickSessionCreator — one-screen session start.
 *
 * Happy path contract: most-recent existing project pre-selected, the
 * embedded branch selector's selection travels into onCreate as
 * branchSelections, group = project name, Enter on the project select
 * confirms. "Avançado…" hands off to the full wizard.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { CreateSessionOpts } from "../types/session";

const projects = [
  {
    id: "proj-old",
    name: "old-project",
    path: "/repos/old",
    path_exists: false,
    session_count: 9,
    last_opened_at: "2026-07-01",
  },
  {
    id: "proj-recent",
    name: "entry-ide",
    path: "/repos/entry-ide",
    path_exists: true,
    session_count: 5,
    last_opened_at: "2026-07-12",
  },
  {
    id: "proj-other",
    name: "other",
    path: "/repos/other",
    path_exists: true,
    session_count: 1,
    last_opened_at: "2026-07-02",
  },
];

vi.mock("../api/projects", () => ({
  getProjectsOrdered: vi.fn(() => Promise.resolve(projects)),
}));

// Stub the heavy branch selector — its own behavior is covered
// elsewhere; here we only exercise the selection contract.
vi.mock("../components/SessionBranchSelector", () => ({
  SessionBranchSelector: ({
    projectId,
    onBranchSelected,
  }: {
    projectId: string;
    onBranchSelected: (b: string, c: boolean) => void;
  }) => (
    <button
      data-testid={`pick-branch-${projectId}`}
      onClick={() => onBranchSelected("feat/quick", true)}
    >
      pick-branch
    </button>
  ),
}));

import { QuickSessionCreator } from "../components/QuickSessionCreator";

function setup() {
  const onCreate = vi.fn((_opts: CreateSessionOpts) => Promise.resolve());
  const onClose = vi.fn();
  const onAdvanced = vi.fn();
  render(<QuickSessionCreator onClose={onClose} onCreate={onCreate} onAdvanced={onAdvanced} />);
  return { onCreate, onClose, onAdvanced };
}

describe("QuickSessionCreator", () => {
  afterEach(cleanup);

  it("pre-selects the most recent project whose folder exists", async () => {
    setup();
    const select = (await screen.findByRole("combobox")) as HTMLSelectElement;
    // proj-old comes first in the ordered list but its folder is missing
    expect(select.value).toBe("proj-recent");
  });

  it("creates with branch selection, project context and group = project name", async () => {
    const { onCreate } = setup();
    await screen.findByRole("combobox");
    fireEvent.click(screen.getByTestId("pick-branch-proj-recent"));
    fireEvent.click(screen.getByTestId("quick-create-btn"));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      mode: "agent",
      aiProvider: "claude",
      projectIds: ["proj-recent"],
      workingDirectory: "/repos/entry-ide",
      branchSelections: { "proj-recent": { branch: "feat/quick", createNew: true, fromRemote: undefined } },
      group: "entry-ide",
    });
  });

  it("Enter on the project select confirms creation", async () => {
    const { onCreate } = setup();
    const select = await screen.findByRole("combobox");
    fireEvent.keyDown(select, { key: "Enter" });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
  });

  it("creates without branchSelections when no branch was picked (no worktree)", async () => {
    const { onCreate } = setup();
    await screen.findByRole("combobox");
    fireEvent.click(screen.getByTestId("quick-create-btn"));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0].branchSelections).toBeUndefined();
  });

  it("switching project resets the branch selection", async () => {
    const { onCreate } = setup();
    const select = await screen.findByRole("combobox");
    fireEvent.click(screen.getByTestId("pick-branch-proj-recent"));
    fireEvent.change(select, { target: { value: "proj-other" } });
    fireEvent.click(screen.getByTestId("quick-create-btn"));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const opts = onCreate.mock.calls[0][0];
    expect(opts.projectIds).toEqual(["proj-other"]);
    expect(opts.branchSelections).toBeUndefined();
  });

  it("Avançado… hands off to the full wizard", async () => {
    const { onAdvanced } = setup();
    await screen.findByRole("combobox");
    fireEvent.click(screen.getByRole("button", { name: /Avançado/ }));
    expect(onAdvanced).toHaveBeenCalled();
  });

  it("Escape closes", async () => {
    const { onClose } = setup();
    const select = await screen.findByRole("combobox");
    fireEvent.keyDown(select, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
