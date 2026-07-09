/**
 * Framework dashboard aggregations — pure-function tests.
 * Verifies the kind-separation contract: cost/token totals come ONLY
 * from `turn` rows; `agent` rows never leak into command totals.
 */
import { describe, it, expect } from "vitest";
import {
  aggregateByAgent,
  aggregateByCommand,
  aggregateByModel,
  formatDuration,
  formatTokens,
  isoDaysAgo,
  PROSE_COMMAND,
} from "../utils/frameworkAggregates";
import type { FrameworkUsageEntry } from "../api/frameworkMetrics";

function row(partial: Partial<FrameworkUsageEntry>): FrameworkUsageEntry {
  return {
    session_id: "s1",
    turn_uuid: null,
    kind: "turn",
    provider: "claude",
    model: "claude-sonnet-5",
    command: null,
    agent: "main",
    phase: null,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    duration_ms: null,
    cost_usd: 0,
    ...partial,
  };
}

const ROWS: FrameworkUsageEntry[] = [
  row({ command: "harness-cmd:task", cost_usd: 0.3, output_tokens: 800, duration_ms: 60_000 }),
  row({ command: "harness-cmd:task", cost_usd: 0.5, output_tokens: 1200, duration_ms: 120_000 }),
  row({ command: "harness-cmd:plan", cost_usd: 0.2, output_tokens: 400, duration_ms: 30_000 }),
  row({ command: null, cost_usd: 0.1, output_tokens: 100 }),
  // agent breakdown rows — must NOT count toward command totals
  row({ kind: "agent", agent: "Build", command: "harness-cmd:task", output_tokens: 700 }),
  row({ kind: "agent", agent: "Build", command: "harness-cmd:task", output_tokens: 300 }),
  row({ kind: "agent", agent: "Reviewer", command: "harness-cmd:task", output_tokens: 200 }),
  // model breakdown row — also excluded from turn sums
  row({ kind: "model", agent: "model:claude-haiku-4-5", model: "claude-haiku-4-5", cost_usd: 0.01 }),
];

describe("aggregateByCommand", () => {
  it("sums only turn rows, grouped by command, sorted by cost", () => {
    const aggs = aggregateByCommand(ROWS);
    expect(aggs.map((a) => a.command)).toEqual([
      "harness-cmd:task",
      "harness-cmd:plan",
      PROSE_COMMAND,
    ]);
    const task = aggs[0];
    expect(task.turns).toBe(2);
    expect(task.costUsd).toBeCloseTo(0.8);
    expect(task.outputTokens).toBe(2000); // agent rows excluded
    expect(task.avgDurationMs).toBe(90_000);
    expect(task.avgCostUsd).toBeCloseTo(0.4);
  });

  it("handles rows without duration", () => {
    const aggs = aggregateByCommand(ROWS);
    const prose = aggs.find((a) => a.command === PROSE_COMMAND)!;
    expect(prose.avgDurationMs).toBeNull();
  });
});

describe("aggregateByAgent", () => {
  it("groups agent rows and sums output tokens", () => {
    const aggs = aggregateByAgent(ROWS);
    expect(aggs[0]).toMatchObject({ agent: "Build", runs: 2, outputTokens: 1000 });
    expect(aggs[1]).toMatchObject({ agent: "Reviewer", runs: 1, outputTokens: 200 });
  });
});

describe("aggregateByModel", () => {
  it("uses only turn rows (model rows are a breakdown, not additive)", () => {
    const aggs = aggregateByModel(ROWS);
    expect(aggs).toHaveLength(1);
    expect(aggs[0].model).toBe("claude-sonnet-5");
    expect(aggs[0].turns).toBe(4);
  });
});

describe("formatters", () => {
  it("formatTokens", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(82_300)).toBe("82.3k");
    expect(formatTokens(12_345_678)).toBe("12.3M");
  });

  it("formatDuration", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(8_000)).toBe("8s");
    expect(formatDuration(125_000)).toBe("2m05s");
  });

  it("isoDaysAgo", () => {
    expect(isoDaysAgo(7, new Date("2026-07-09T12:00:00Z"))).toBe("2026-07-02");
  });
});
