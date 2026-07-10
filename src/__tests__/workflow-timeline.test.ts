/**
 * Workflow timeline derivation — pure-function tests for the unified
 * Workflow tab (composes pipeline phases + artifacts + git files + cost).
 */
import { describe, it, expect } from "vitest";
import {
  collectArtifacts,
  collectChangedFiles,
  deriveTimelineCost,
  deriveWorkflowTimeline,
} from "../utils/workflowTimeline";
import type { PipelineState } from "../utils/pipelinePhases";
import type { GitSessionStatus, GitFile } from "../types/git";
import type { FrameworkUsageEntry } from "../api/frameworkMetrics";

const EMPTY_PIPELINE: PipelineState = {
  branch: null,
  commits_ahead: null,
  spike_doc: null,
  spec_doc: null,
  plan_doc: null,
  pr_number: null,
  pr_url: null,
  pr_state: null,
};

function gitFile(partial: Partial<GitFile> & { path: string }): GitFile {
  return {
    status: "modified",
    area: "unstaged",
    old_path: null,
    ...partial,
  };
}

function gitStatus(files: GitFile[]): GitSessionStatus {
  return {
    projects: [
      {
        project_id: "p1",
        project_name: "repo",
        project_path: "/repo",
        is_git_repo: true,
        branch: "feat/x",
        remote_branch: null,
        ahead: 0,
        behind: 0,
        files,
        has_conflicts: false,
        stash_count: 0,
        error: null,
      },
    ],
    timestamp: 0,
  };
}

function usageRow(partial: Partial<FrameworkUsageEntry>): FrameworkUsageEntry {
  return {
    session_id: "s1",
    turn_uuid: null,
    kind: "turn",
    provider: "claude",
    model: "claude-x",
    command: "harness-cmd:plan",
    agent: "main",
    phase: "plan",
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    duration_ms: null,
    cost_usd: 0,
    recorded_at: null,
    ...partial,
  };
}

describe("deriveWorkflowTimeline", () => {
  it("always renders the four phases, even on an empty worktree", () => {
    const tl = deriveWorkflowTimeline(EMPTY_PIPELINE, null, null, []);
    const phaseSections = tl.sections.filter((s) => s.kind === "phase");
    expect(phaseSections).toHaveLength(4);
    expect(tl.hasArtifacts).toBe(false);
    expect(tl.changedFileCount).toBe(0);
    expect(tl.hasCost).toBe(false);
  });

  it("adds an artifacts section when spike/spec/plan docs exist", () => {
    const tl = deriveWorkflowTimeline(
      {
        ...EMPTY_PIPELINE,
        spike_doc: "/r/spike.md",
        spec_doc: "/r/SPEC.md",
        plan_doc: "/r/PLAN.md",
      },
      null,
      null,
      [],
    );
    expect(tl.hasArtifacts).toBe(true);
    const art = tl.sections.find((s) => s.kind === "artifacts");
    expect(art?.kind === "artifacts" && art.items.map((i) => i.label)).toEqual([
      "spike.md",
      "SPEC.md",
      "PLAN.md",
    ]);
  });

  it("adds a files section with changed files sorted by area then path", () => {
    const tl = deriveWorkflowTimeline(
      EMPTY_PIPELINE,
      null,
      gitStatus([
        gitFile({ path: "b.ts", area: "unstaged" }),
        gitFile({ path: "a.ts", area: "staged", status: "added" }),
        gitFile({ path: "c.txt", area: "untracked", status: "untracked" }),
      ]),
      [],
    );
    expect(tl.changedFileCount).toBe(3);
    const files = tl.sections.find((s) => s.kind === "files");
    expect(
      files?.kind === "files" && files.files.map((f) => f.path),
    ).toEqual(["a.ts", "b.ts", "c.txt"]);
  });

  it("adds a cost section when metrics rows exist", () => {
    const tl = deriveWorkflowTimeline(
      EMPTY_PIPELINE,
      "plan",
      null,
      [
        usageRow({ phase: "plan", input_tokens: 100, output_tokens: 200, cost_usd: 0.5 }),
        usageRow({ phase: "plan", input_tokens: 10, output_tokens: 20, cost_usd: 0.05 }),
        // non-turn rows are excluded from totals
        usageRow({ kind: "agent", phase: "plan", output_tokens: 9999 }),
      ],
    );
    expect(tl.hasCost).toBe(true);
    const cost = tl.sections.find((s) => s.kind === "cost");
    expect(cost?.kind === "cost" && cost.cost.phase).toBe("plan");
    expect(cost?.kind === "cost" && cost.cost.turns).toBe(2);
    expect(cost?.kind === "cost" && cost.cost.inputTokens).toBe(110);
    expect(cost?.kind === "cost" && cost.cost.outputTokens).toBe(220);
    expect(cost?.kind === "cost" && cost.cost.costUsd).toBeCloseTo(0.55);
  });

  it("orders sections phase → artifacts → files → cost", () => {
    const tl = deriveWorkflowTimeline(
      { ...EMPTY_PIPELINE, spike_doc: "/r/spike.md" },
      null,
      gitStatus([gitFile({ path: "x.ts" })]),
      [usageRow({ phase: "spike", cost_usd: 0.1 })],
    );
    const kinds = tl.sections.map((s) => s.kind);
    // four phases + artifacts + files + cost
    expect(kinds).toEqual([
      "phase", "phase", "phase", "phase",
      "artifacts", "files", "cost",
    ]);
  });
});

describe("collectArtifacts", () => {
  it("collects artifacts across phases in phase order", () => {
    const tl = deriveWorkflowTimeline(
      { ...EMPTY_PIPELINE, spike_doc: "/r/spike.md", spec_doc: "/r/SPEC.md", plan_doc: "/r/PLAN.md" },
      null, null, [],
    );
    const phases = tl.sections.filter((s) => s.kind === "phase").map((s) => s.kind === "phase" && s.phase);
    const arts = collectArtifacts(phases as never);
    expect(arts.map((a) => a.phase)).toEqual(["spike", "plan", "plan"]);
  });
});

describe("collectChangedFiles", () => {
  it("dedupes identical files across projects", () => {
    const status: GitSessionStatus = {
      projects: [
        { ...gitStatus([gitFile({ path: "a.ts" })]).projects[0], project_id: "p1" },
        { ...gitStatus([gitFile({ path: "a.ts" }), gitFile({ path: "b.ts" })]).projects[0], project_id: "p2" },
      ],
      timestamp: 0,
    };
    const files = collectChangedFiles(status);
    expect(files.map((f) => f.path).sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("returns [] for null status", () => {
    expect(collectChangedFiles(null)).toEqual([]);
  });
});

describe("deriveTimelineCost", () => {
  it("falls back to the latest phase with rows when no running phase", () => {
    const cost = deriveTimelineCost(
      [
        usageRow({ phase: "spike", cost_usd: 0.1 }),
        usageRow({ phase: "plan", cost_usd: 0.2 }),
      ],
      null,
    );
    // plan is later than spike in PHASE_ORDER fall-back, but fall-back picks
    // newest-by-phase-order (pr, task, plan, spike) → plan.
    expect(cost.phase).toBe("plan");
    expect(cost.costUsd).toBeCloseTo(0.2);
  });

  it("returns a zero cost when there are no turn rows", () => {
    const cost = deriveTimelineCost([], "spike");
    expect(cost.turns).toBe(0);
    expect(cost.costUsd).toBe(0);
  });
});