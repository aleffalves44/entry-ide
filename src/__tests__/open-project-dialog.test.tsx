// @vitest-environment jsdom
/**
 * OpenProjectDialog — browse an existing project (recency-ordered list,
 * missing folders filtered out, add-folder shortcut).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const projects = [
  { id: "gone", name: "gone", path: "/repos/gone", path_exists: false, session_count: 1, last_opened_at: "2026-07-10" },
  { id: "recent", name: "entry-ide", path: "/Users/x/repos/entry-ide", path_exists: true, session_count: 4, last_opened_at: "2026-07-13" },
];

const createProjectMock = vi.fn((path: string) =>
  Promise.resolve({ id: "novo", name: "novo", path }),
);
vi.mock("../api/projects", () => ({
  getProjectsOrdered: vi.fn(() => Promise.resolve(projects)),
  createProject: (path: string, name: string | null) => createProjectMock(path, name),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(() => Promise.resolve("/repos/novo")),
}));

import { OpenProjectDialog } from "../components/OpenProjectDialog";

describe("OpenProjectDialog", () => {
  afterEach(cleanup);

  it("lists only projects whose folder exists and picks on click", async () => {
    const onPick = vi.fn();
    render(<OpenProjectDialog onClose={() => {}} onPick={onPick} />);
    await waitFor(() => screen.getByText("entry-ide"));
    expect(screen.queryByText("gone")).toBeNull();
    fireEvent.click(screen.getByText("entry-ide"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "recent" }));
  });

  it("adding a folder registers the project and picks it directly", async () => {
    const onPick = vi.fn();
    render(<OpenProjectDialog onClose={() => {}} onPick={onPick} />);
    await waitFor(() => screen.getByText("entry-ide"));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar pasta/ }));
    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith("/repos/novo", null);
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({ id: "novo", path_exists: true }),
      );
    });
  });
});
