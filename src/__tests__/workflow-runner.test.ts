/**
 * Workflow runner — pure-function tests for the "Rodar workflow" chaining
 * logic (next pending phase + approval stops).
 */
import { describe, it, expect } from "vitest";
import {
  PHASE_ORDER,
  decideRunnerAction,
  isApprovedPastOrAt,
  nextPhaseToRun,
  phaseCommandDraft,
} from "../utils/workflowRunner";
import { derivePipelinePhases, type PipelineState } from "../utils/pipelinePhases";

const EMPTY: PipelineState = {
  branch: null,
  commits_ahead: null,
  spike_doc: null,
  spec_doc: null,
  plan_doc: null,
  pr_number: null,
  pr_url: null,
  pr_state: null,
};

function phasesFor(state: PipelineState, running: string | null) {
  return derivePipelinePhases(state, running as never);
}

describe("nextPhaseToRun", () => {
  it("returns the first pending phase when idle", () => {
    expect(nextPhaseToRun(phasesFor(EMPTY, null), false)).toBe("spike");
  });

  it("skips done phases", () => {
    const state: PipelineState = {
      ...EMPTY,
      spike_doc: "/r/spike.md",
      spec_doc: "/r/SPEC.md",
      plan_doc: "/r/PLAN.md",
      branch: "feat/x",
      commits_ahead: 2,
    };
    expect(nextPhaseToRun(phasesFor(state, null), false)).toBe("pr");
  });

  it("returns null while a turn is streaming", () => {
    expect(nextPhaseToRun(phasesFor(EMPTY, null), true)).toBeNull();
  });

  it("returns null when everything is done", () => {
    const state: PipelineState = {
      ...EMPTY,
      spike_doc: "/r/spike.md",
      spec_doc: "/r/SPEC.md",
      plan_doc: "/r/PLAN.md",
      branch: "feat/x",
      commits_ahead: 2,
      pr_number: 9,
      pr_url: "https://x",
      pr_state: "OPEN",
    };
    expect(nextPhaseToRun(phasesFor(state, null), false)).toBeNull();
  });
});

describe("decideRunnerAction", () => {
  it("dispatches the next pending phase when no stop applies", () => {
    const action = decideRunnerAction(phasesFor(EMPTY, null), false, new Set(), null);
    expect(action).toEqual({ action: "dispatch", phase: "spike" });
  });

  it("pauses before a phase marked as a stop", () => {
    // spike done → next pending is plan; stop after plan means pause BEFORE plan? 
    // The stop set marks phases that require approval before dispatching them.
    const state: PipelineState = { ...EMPTY, spike_doc: "/r/spike.md" };
    const action = decideRunnerAction(phasesFor(state, null), false, new Set(["plan"]), null);
    expect(action).toEqual({ action: "pause", phase: "plan" });
  });

  it("dispatches past a stop once the user approved it", () => {
    const state: PipelineState = { ...EMPTY, spike_doc: "/r/spike.md" };
    const action = decideRunnerAction(phasesFor(state, null), false, new Set(["plan"]), "plan");
    expect(action).toEqual({ action: "dispatch", phase: "plan" });
  });

  it("waits while a turn is streaming", () => {
    const action = decideRunnerAction(phasesFor(EMPTY, "spike"), true, new Set(), null);
    expect(action).toEqual({ action: "wait" });
  });

  it("completes when every phase is done and idle", () => {
    const state: PipelineState = {
      ...EMPTY,
      spike_doc: "/r/spike.md",
      spec_doc: "/r/SPEC.md",
      plan_doc: "/r/PLAN.md",
      branch: "feat/x",
      commits_ahead: 2,
      pr_number: 9,
      pr_url: "https://x",
      pr_state: "OPEN",
    };
    const action = decideRunnerAction(phasesFor(state, null), false, new Set(), null);
    expect(action).toEqual({ action: "complete" });
  });
});

describe("isApprovedPastOrAt", () => {
  it("treats approval of a later phase as clearing earlier stops", () => {
    expect(isApprovedPastOrAt("task", "plan")).toBe(true);
    expect(isApprovedPastOrAt("plan", "plan")).toBe(true);
    expect(isApprovedPastOrAt("spike", "plan")).toBe(false);
    expect(isApprovedPastOrAt(null, "plan")).toBe(false);
  });
});

describe("phaseCommandDraft", () => {
  it("builds the slash command with optional args", () => {
    expect(phaseCommandDraft("task", "CRED-1234")).toBe("/harness-cmd:task CRED-1234");
    expect(phaseCommandDraft("spike", "")).toBe("/harness-cmd:spike");
    expect(phaseCommandDraft("plan", "  ")).toBe("/harness-cmd:plan");
  });
});

describe("PHASE_ORDER", () => {
  it("walks spike → plan → task → pr", () => {
    expect(PHASE_ORDER).toEqual(["spike", "plan", "task", "pr"]);
  });
});