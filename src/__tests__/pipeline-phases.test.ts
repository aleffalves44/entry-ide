/**
 * Pipeline phase derivation — pure-function tests for the Workbench
 * Pipeline tab (SDD workflow: spike → plan → task → pr).
 */
import { describe, it, expect } from "vitest";
import {
  derivePipelinePhases,
  formatPhaseDetail,
  hasHarnessPlugin,
  runningPhaseFromCommand,
  PHASE_DESCRIPTIONS,
  type PipelineState,
} from "../utils/pipelinePhases";
import { translate } from "../i18n";
import { en } from "../i18n/en";
import { ptBR } from "../i18n/ptBR";

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

describe("derivePipelinePhases", () => {
  it("marks everything pending on an empty worktree", () => {
    const phases = derivePipelinePhases(EMPTY, null);
    expect(phases.map((p) => p.key)).toEqual(["spike", "plan", "task", "pr"]);
    expect(phases.every((p) => p.status === "pending")).toBe(true);
  });

  it("derives done state from worktree facts, not tracking", () => {
    const phases = derivePipelinePhases(
      {
        ...EMPTY,
        branch: "feat/x",
        spike_doc: "/repo/docs/spike-auth.md",
        spec_doc: "/repo/SPEC.md",
        plan_doc: "/repo/PLAN.md",
        commits_ahead: 3,
        pr_number: 42,
        pr_url: "https://github.com/o/r/pull/42",
        pr_state: "OPEN",
      },
      null,
    );
    expect(phases.map((p) => p.status)).toEqual(["done", "done", "done", "done"]);
    expect(phases[1].artifacts.map((a) => a.label)).toEqual(["SPEC.md", "PLAN.md"]);
    expect(phases[2].detail).toEqual({ kind: "commits", count: 3, branch: "feat/x" });
    expect(phases[3].detail).toEqual({ kind: "pr", prNumber: 42, prState: "OPEN" });
  });

  it("plan is not done with only SPEC.md (PLAN.md missing)", () => {
    const phases = derivePipelinePhases({ ...EMPTY, spec_doc: "/repo/SPEC.md" }, null);
    expect(phases[1].status).toBe("pending");
    expect(phases[1].artifacts).toHaveLength(1);
  });

  it("running phase overrides done/pending", () => {
    const phases = derivePipelinePhases({ ...EMPTY, spec_doc: "/r/SPEC.md", plan_doc: "/r/PLAN.md" }, "plan");
    expect(phases[1].status).toBe("running");
  });

  it("tolerates a null state (backend unreachable)", () => {
    const phases = derivePipelinePhases(null, null);
    expect(phases).toHaveLength(4);
    expect(phases.every((p) => p.status === "pending")).toBe(true);
  });
});

describe("runningPhaseFromCommand", () => {
  it("maps the in-flight command to its phase while streaming", () => {
    expect(runningPhaseFromCommand("harness-cmd:task", true)).toBe("task");
    expect(runningPhaseFromCommand("plan", true)).toBe("plan");
  });

  it("returns null when idle or for prose/non-phase commands", () => {
    expect(runningPhaseFromCommand("harness-cmd:task", false)).toBeNull();
    expect(runningPhaseFromCommand(null, true)).toBeNull();
    expect(runningPhaseFromCommand("compact", true)).toBeNull();
  });
});

describe("PHASE_DESCRIPTIONS (RF-06)", () => {
  it("has exactly the four expected keys in order", () => {
    expect(Object.keys(PHASE_DESCRIPTIONS)).toEqual(["spike", "plan", "task", "pr"]);
  });

  it("every value is a non-empty string", () => {
    for (const key of Object.keys(PHASE_DESCRIPTIONS) as (keyof typeof PHASE_DESCRIPTIONS)[]) {
      const val = PHASE_DESCRIPTIONS[key];
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }
  });
});

describe("formatPhaseDetail", () => {
  const tEn = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
    translate(en, k, v);
  const tPt = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
    translate(ptBR, k, v);

  it("localizes the commits detail with branch, singular vs plural", () => {
    expect(formatPhaseDetail({ kind: "commits", count: 3, branch: "feat/x" }, tEn)).toBe(
      "3 commits on feat/x",
    );
    expect(formatPhaseDetail({ kind: "commits", count: 3, branch: "feat/x" }, tPt)).toBe(
      "3 commits em feat/x",
    );
    expect(formatPhaseDetail({ kind: "commits", count: 1, branch: null }, tEn)).toBe("1 commit");
  });

  it("localizes the branch-only detail", () => {
    expect(formatPhaseDetail({ kind: "branch", branch: "feat/x" }, tEn)).toBe("branch feat/x");
  });

  it("keeps PR detail technical (locale-agnostic)", () => {
    expect(formatPhaseDetail({ kind: "pr", prNumber: 42, prState: "OPEN" }, tEn)).toBe(
      "PR #42 · open",
    );
    expect(formatPhaseDetail({ kind: "pr", prNumber: 7, prState: null }, tPt)).toBe("PR #7");
  });
});

describe("hasHarnessPlugin", () => {
  it("detects harness-cmd skills in string and object shapes", () => {
    expect(hasHarnessPlugin(["docker", "harness-cmd:plan"])).toBe(true);
    expect(hasHarnessPlugin([{ command: "harness-cmd:task" }])).toBe(true);
  });

  it("returns false without the plugin or without init data", () => {
    expect(hasHarnessPlugin(["docker", "lemon-pie-harness:critic"])).toBe(false);
    expect(hasHarnessPlugin(undefined)).toBe(false);
    expect(hasHarnessPlugin(null)).toBe(false);
  });
});
