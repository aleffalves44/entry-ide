// @vitest-environment jsdom
/**
 * Component-level coverage for the WorkbenchNotes editor (1.1.14).
 *
 * Pins the contracts a user can see:
 *   - typing dispatches SET_SESSION_NOTE with the new content
 *   - the textarea value reflects state.notes[sessionId]
 *   - switching sessions loads the right note (no leak)
 *   - the saved indicator flips dirty → saved on quiet
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const dispatchMock = vi.fn();

const fakeState: { notes: Record<string, string> } = {
  notes: {},
};

vi.mock("../state/SessionContext", () => ({
  useSession: () => ({ state: fakeState, dispatch: dispatchMock }),
}));

import { WorkbenchNotes } from "../components/WorkbenchNotes";
import type { SessionData } from "../types/session";

function sess(id: string): SessionData {
  return {
    id,
    label: id,
    mode: "agent",
    phase: "idle",
    workspace_paths: [],
  } as unknown as SessionData;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  dispatchMock.mockClear();
  fakeState.notes = {};
});

describe("WorkbenchNotes · typing", () => {
  it("dispatches SET_SESSION_NOTE on each change", () => {
    render(<WorkbenchNotes session={sess("s1")} />);
    const ta = screen.getByTestId("workbench-notes-textarea") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "hello" } });
    const drafts = dispatchMock.mock.calls.map((c) => c[0]);
    expect(drafts).toContainEqual({
      type: "SET_SESSION_NOTE",
      sessionId: "s1",
      content: "hello",
    });
  });

  it("displays the note from state for the active session", () => {
    fakeState.notes = { s1: "loaded from state" };
    render(<WorkbenchNotes session={sess("s1")} />);
    const ta = screen.getByTestId("workbench-notes-textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("loaded from state");
  });

  it("scopes notes per session id (no leak when state.notes has multiple)", () => {
    fakeState.notes = { s1: "for one", s2: "for two" };
    render(<WorkbenchNotes session={sess("s2")} />);
    const ta = screen.getByTestId("workbench-notes-textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("for two");
  });
});

describe("WorkbenchNotes · saved indicator", () => {
  it("shows 'Empty' when nothing is in state", () => {
    render(<WorkbenchNotes session={sess("s1")} />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("flips to 'Editing…' on input, then back to 'Saved …' after the quiet window", () => {
    fakeState.notes = { s1: "" };
    render(<WorkbenchNotes session={sess("s1")} />);
    const ta = screen.getByTestId("workbench-notes-textarea") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "x" } });
    // Immediately after typing.
    expect(screen.getByText("Editing…")).toBeInTheDocument();
    // After the debounce window (the component uses 600ms internally).
    act(() => {
      vi.advanceTimersByTime(700);
    });
    // The label switches to a "Saved · HH:MM" string.
    expect(screen.queryByText("Editing…")).not.toBeInTheDocument();
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });
});
