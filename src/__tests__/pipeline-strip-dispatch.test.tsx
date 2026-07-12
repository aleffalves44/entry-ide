// @vitest-environment jsdom
/**
 * PipelineStrip one-click dispatch (M2)
 *
 * Clicking a phase on the strip opens an inline context input (what the
 * command needs) and dispatches the plugin slash command through the
 * chat — same contract as the Workflow tab's panel.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const dispatchMock = vi.fn();
const submitToAgentMock = vi.fn(() => Promise.resolve());

vi.mock("../state/SessionContext", () => ({
  useSession: () => ({ dispatch: dispatchMock }),
}));
vi.mock("../utils/submitToAgent", () => ({
  submitToAgent: (...args: unknown[]) => submitToAgentMock(...args),
}));

const timelineState = {
  phases: [
    { key: "spike", label: "Spike", command: "harness-cmd:spike", status: "done", artifacts: [], detail: null },
    { key: "plan", label: "Plan", command: "harness-cmd:plan", status: "pending", artifacts: [], detail: null },
    { key: "task", label: "Task", command: "harness-cmd:task", status: "pending", artifacts: [], detail: null },
    { key: "pr", label: "PR", command: "harness-cmd:pr", status: "pending", artifacts: [], detail: null },
  ],
  pluginPresent: true,
  pluginMissing: false,
  isStreaming: false,
  loading: false,
  refresh: () => {},
  timeline: { sections: [], hasArtifacts: false, changedFileCount: 0, hasCost: false },
};

vi.mock("../hooks/useWorkflowTimeline", () => ({
  useWorkflowTimeline: () => timelineState,
}));

import { PipelineStrip } from "../components/PipelineStrip";
import type { SessionData } from "../types/session";

const session = { id: "sess-1" } as SessionData;

describe("PipelineStrip one-click dispatch", () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    submitToAgentMock.mockClear();
    timelineState.isStreaming = false;
  });
  afterEach(cleanup);

  it("clicking a phase opens the context input with the phase placeholder", () => {
    render(<PipelineStrip session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    const input = screen.getByPlaceholderText(/CRED-1234 ou descrição da feature/);
    expect(input).toBeTruthy();
  });

  it("Enter dispatches the slash command with the typed context", () => {
    render(<PipelineStrip session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    const input = screen.getByPlaceholderText(/CRED-1234 ou descrição da feature/);
    fireEvent.change(input, { target: { value: "CRED-42" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(submitToAgentMock).toHaveBeenCalledWith("sess-1", "/harness-cmd:plan CRED-42", []);
    // Popover closes after dispatch
    expect(screen.queryByTestId("pipeline-strip-popover")).toBeNull();
  });

  it("empty context dispatches the bare command", () => {
    render(<PipelineStrip session={session} />);
    fireEvent.click(screen.getByRole("button", { name: /Task/ }));
    fireEvent.click(screen.getByRole("button", { name: /Executar/ }));
    expect(submitToAgentMock).toHaveBeenCalledWith("sess-1", "/harness-cmd:task", []);
  });

  it("phases are disabled while a turn is streaming", () => {
    timelineState.isStreaming = true;
    render(<PipelineStrip session={session} />);
    const btn = screen.getByRole("button", { name: /Plan/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(screen.queryByTestId("pipeline-strip-popover")).toBeNull();
  });

  it("PIPELINE tag opens the Workflow tab instead of dispatching", () => {
    render(<PipelineStrip session={session} />);
    fireEvent.click(screen.getByRole("button", { name: "PIPELINE" }));
    expect(dispatchMock).toHaveBeenCalledWith({ type: "SET_WORKBENCH_OPEN", open: true });
    expect(dispatchMock).toHaveBeenCalledWith({ type: "SET_WORKBENCH_TAB", tab: "workflow" });
    expect(submitToAgentMock).not.toHaveBeenCalled();
  });
});
