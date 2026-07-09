// @vitest-environment jsdom
/**
 * PipelinePanel v2.0 — expandable phase sections.
 * Covers RF-01 to RF-05, UI-01 to UI-03.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

// --- submitToAgent mock (must be hoisted before component import) ---
const submitToAgentMock = vi.fn(() => Promise.resolve());
vi.mock("../utils/submitToAgent", () => ({
  submitToAgent: (...args: unknown[]) => submitToAgentMock(...args),
}));

// --- projects API mock ---
vi.mock("../api/projects", () => ({
  getSessionProjects: vi.fn(() => Promise.resolve([])),
}));

// --- SessionContext mock ---
const dispatchMock = vi.fn();
vi.mock("../state/SessionContext", () => ({
  useSession: () => ({ state: {}, dispatch: dispatchMock }),
}));

// --- usePipelineState mock ---
import { derivePipelinePhases } from "../utils/pipelinePhases";

const pipelineStateMock = {
  phases: derivePipelinePhases(null, null),
  pipeline: null,
  loading: false,
  refresh: vi.fn(),
  isStreaming: false,
  pluginMissing: false,
  pluginPresent: true,
};

vi.mock("../hooks/usePipelineState", () => ({
  usePipelineState: () => pipelineStateMock,
}));

import { PipelinePanel } from "../components/PipelinePanel";
import { PHASE_DESCRIPTIONS, PHASE_PLACEHOLDERS } from "../utils/pipelinePhases";
import type { SessionData } from "../types/session";

const SESSION: SessionData = {
  id: "test-session",
  label: "Test",
  description: "",
  color: "",
  group: null,
  phase: "ready",
  working_directory: "/tmp",
  shell: "/bin/zsh",
  created_at: "",
  last_activity_at: "",
  workspace_paths: [],
  detected_agent: null,
  metrics: {
    total_sessions: 0,
    total_commands: 0,
    active_sessions: 0,
    avg_session_duration_secs: 0,
    commands_last_24h: 0,
    sessions_last_7d: 0,
  },
  ai_provider: "claude",
  auto_approve: false,
  permission_mode: "default",
  custom_prefix: "",
  custom_suffix: "",
  channels: [],
  context_injected: false,
  ssh_info: null,
  mode: "agent",
};

function renderPanel() {
  return render(<PipelinePanel session={SESSION} />);
}

function getRows() {
  return document.querySelectorAll(".pipeline-phase-row");
}

function clickRow(index: number) {
  const rows = getRows();
  fireEvent.click(rows[index]);
}

describe("RF-01 — no expanded section when nothing is active", () => {
  afterEach(() => cleanup());

  it("renders no .pipeline-phase-expanded on initial mount", () => {
    renderPanel();
    expect(document.querySelectorAll(".pipeline-phase-expanded")).toHaveLength(0);
  });

  it("renders no text input inside the panel", () => {
    renderPanel();
    expect(document.querySelectorAll('input[type="text"]')).toHaveLength(0);
  });
});

describe("RF-02 — toggle expand/collapse", () => {
  afterEach(() => cleanup());

  it("clicking a row opens its expanded section", () => {
    renderPanel();
    clickRow(1); // plan
    expect(document.querySelectorAll(".pipeline-phase-expanded")).toHaveLength(1);
  });

  it("clicking a different row closes previous and opens new one", () => {
    renderPanel();
    clickRow(1); // plan
    clickRow(0); // spike
    const expanded = document.querySelectorAll(".pipeline-phase-expanded");
    expect(expanded).toHaveLength(1);
    // The expanded section should be inside the first <li> (spike)
    const lis = document.querySelectorAll(".pipeline-phase");
    expect(lis[0].querySelector(".pipeline-phase-expanded")).not.toBeNull();
    expect(lis[1].querySelector(".pipeline-phase-expanded")).toBeNull();
  });

  it("clicking the same row again collapses it", () => {
    renderPanel();
    clickRow(0); // open spike
    clickRow(0); // close spike
    expect(document.querySelectorAll(".pipeline-phase-expanded")).toHaveLength(0);
  });
});

describe("RF-03 — send dispatches exact bare command", () => {
  beforeEach(() => {
    submitToAgentMock.mockClear();
  });
  afterEach(() => cleanup());

  const cases: [string, number, string][] = [
    ["spike", 0, "/harness-cmd:spike"],
    ["plan", 1, "/harness-cmd:plan"],
    ["task", 2, "/harness-cmd:task"],
    ["pr", 3, "/harness-cmd:pr"],
  ];

  for (const [phaseName, rowIndex, expectedDraft] of cases) {
    it(`send for ${phaseName} calls submitToAgent with "${expectedDraft}"`, () => {
      renderPanel();
      clickRow(rowIndex);
      const sendBtn = document.querySelector(".pipeline-phase-send") as HTMLButtonElement;
      expect(sendBtn).not.toBeNull();
      fireEvent.click(sendBtn);
      expect(submitToAgentMock).toHaveBeenCalledTimes(1);
      expect(submitToAgentMock).toHaveBeenCalledWith("test-session", expectedDraft, []);
    });
  }
});

describe("RF-04 — isStreaming blocks interaction", () => {
  afterEach(() => cleanup());

  it("send button is disabled when isStreaming=true", () => {
    pipelineStateMock.isStreaming = true;
    pipelineStateMock.phases = derivePipelinePhases(null, null);
    // Manually set an active phase by opening it when streaming=false first,
    // then re-render with streaming=true. Instead we just directly render with
    // a pre-expanded state by temporarily overriding — but since state is local,
    // we click first with isStreaming=false then rerender.
    pipelineStateMock.isStreaming = false;
    const { rerender } = renderPanel();
    clickRow(0);
    pipelineStateMock.isStreaming = true;
    rerender(<PipelinePanel session={SESSION} />);
    const sendBtn = document.querySelector(".pipeline-phase-send") as HTMLButtonElement;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn).toBeDisabled();
    pipelineStateMock.isStreaming = false;
  });

  it("clicking a row when isStreaming=true does not open expanded section", () => {
    pipelineStateMock.isStreaming = true;
    renderPanel();
    clickRow(0);
    expect(document.querySelectorAll(".pipeline-phase-expanded")).toHaveLength(0);
    pipelineStateMock.isStreaming = false;
  });
});

describe("RF-05 — removed elements absent", () => {
  afterEach(() => cleanup());

  it("no .pipeline-task-input in DOM", () => {
    renderPanel();
    expect(document.querySelector(".pipeline-task-input")).toBeNull();
  });

  it("no .pipeline-phase-run buttons in DOM", () => {
    renderPanel();
    expect(document.querySelectorAll(".pipeline-phase-run")).toHaveLength(0);
  });

  it("submitToAgent is not called by anything outside .pipeline-phase-expanded", () => {
    submitToAgentMock.mockClear();
    renderPanel();
    // Click each row without sending — no submit should fire
    for (let i = 0; i < 4; i++) {
      clickRow(i);
    }
    expect(submitToAgentMock).not.toHaveBeenCalled();
  });
});

describe("UI-01 — aria and keyboard", () => {
  afterEach(() => cleanup());

  it("every phase row has role=button and tabIndex=0", () => {
    renderPanel();
    const rows = getRows();
    expect(rows).toHaveLength(4);
    rows.forEach((row) => {
      expect(row).toHaveAttribute("role", "button");
      expect(row).toHaveAttribute("tabindex", "0");
    });
  });

  it("aria-expanded reflects active phase", () => {
    renderPanel();
    const rows = getRows();
    rows.forEach((row) => {
      expect(row).toHaveAttribute("aria-expanded", "false");
    });
    clickRow(0); // open spike
    expect(rows[0]).toHaveAttribute("aria-expanded", "true");
    expect(rows[1]).toHaveAttribute("aria-expanded", "false");
  });

  it("aria-disabled is set on all rows when isStreaming=true", () => {
    pipelineStateMock.isStreaming = true;
    renderPanel();
    const rows = getRows();
    rows.forEach((row) => {
      expect(row).toHaveAttribute("aria-disabled", "true");
    });
    pipelineStateMock.isStreaming = false;
  });

  it("Enter key toggles the phase", () => {
    renderPanel();
    const rows = getRows();
    fireEvent.keyDown(rows[0], { key: "Enter" });
    expect(rows[0]).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(rows[0], { key: "Enter" });
    expect(rows[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("Space key toggles the phase", () => {
    renderPanel();
    const rows = getRows();
    fireEvent.keyDown(rows[1], { key: " " });
    expect(rows[1]).toHaveAttribute("aria-expanded", "true");
  });
});

describe("UI-02 — DOM order: row then expanded then detail/artifacts", () => {
  afterEach(() => cleanup());

  it("expanded section is the second child of <li> when open", () => {
    renderPanel();
    clickRow(0); // spike (no detail, no artifacts in empty state)
    const lis = document.querySelectorAll(".pipeline-phase");
    const li = lis[0];
    expect(li.children[0]).toHaveClass("pipeline-phase-row");
    expect(li.children[1]).toHaveClass("pipeline-phase-expanded");
  });
});

describe("UI-03 — expanded section content", () => {
  afterEach(() => cleanup());

  it("shows PHASE_DESCRIPTIONS.spike text when spike is open", () => {
    renderPanel();
    clickRow(0);
    expect(screen.getByText(PHASE_DESCRIPTIONS.spike)).toBeInTheDocument();
  });

  it("renders context input with the phase placeholder", () => {
    renderPanel();
    clickRow(0);
    const input = document.querySelector(
      ".pipeline-phase-expanded input.pipeline-phase-input",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("placeholder", PHASE_PLACEHOLDERS.spike);
  });

  it("exactly one send button visible when a phase is open", () => {
    renderPanel();
    clickRow(0);
    const sendBtns = screen.getAllByRole("button", { name: /enviar|send/i });
    expect(sendBtns).toHaveLength(1);
  });
});

describe("RF-06 — context input feeds the slash-command argument", () => {
  beforeEach(() => {
    submitToAgentMock.mockClear();
  });
  afterEach(() => cleanup());

  function getInput(): HTMLInputElement {
    return document.querySelector(".pipeline-phase-input") as HTMLInputElement;
  }

  it("typed context is appended to the command on send", () => {
    renderPanel();
    clickRow(1); // plan
    fireEvent.change(getInput(), { target: { value: "CRED-1234" } });
    fireEvent.click(document.querySelector(".pipeline-phase-send") as HTMLButtonElement);
    expect(submitToAgentMock).toHaveBeenCalledWith(
      "test-session",
      "/harness-cmd:plan CRED-1234",
      [],
    );
  });

  it("whitespace-only context sends the bare command", () => {
    renderPanel();
    clickRow(0); // spike
    fireEvent.change(getInput(), { target: { value: "   " } });
    fireEvent.click(document.querySelector(".pipeline-phase-send") as HTMLButtonElement);
    expect(submitToAgentMock).toHaveBeenCalledWith("test-session", "/harness-cmd:spike", []);
  });

  it("Enter inside the input sends the command with the argument", () => {
    renderPanel();
    clickRow(0); // spike
    fireEvent.change(getInput(), { target: { value: "investigar cache" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(submitToAgentMock).toHaveBeenCalledTimes(1);
    expect(submitToAgentMock).toHaveBeenCalledWith(
      "test-session",
      "/harness-cmd:spike investigar cache",
      [],
    );
  });

  it("draft persists per phase across accordion toggles and after send", () => {
    renderPanel();
    clickRow(0); // spike
    fireEvent.change(getInput(), { target: { value: "CRED-1" } });
    clickRow(1); // switch to plan — spike collapses
    expect(getInput().value).toBe(""); // plan draft independent
    fireEvent.change(getInput(), { target: { value: "CRED-2" } });
    fireEvent.click(document.querySelector(".pipeline-phase-send") as HTMLButtonElement);
    expect(getInput().value).toBe("CRED-2"); // survives send
    clickRow(0); // back to spike
    expect(getInput().value).toBe("CRED-1"); // survives collapse
  });

  it("clicking the input does not collapse the row", () => {
    renderPanel();
    clickRow(0);
    fireEvent.click(getInput());
    expect(document.querySelectorAll(".pipeline-phase-expanded")).toHaveLength(1);
  });

  it("input is disabled while streaming", () => {
    pipelineStateMock.isStreaming = false;
    const { rerender } = renderPanel();
    clickRow(0);
    pipelineStateMock.isStreaming = true;
    rerender(<PipelinePanel session={SESSION} />);
    expect(getInput()).toBeDisabled();
    pipelineStateMock.isStreaming = false;
  });
});
