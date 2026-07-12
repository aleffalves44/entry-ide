// @vitest-environment jsdom
/**
 * SessionUsageWidget (M3) — inline per-session consumption readout.
 *
 * Collapsed one-liner with total tokens/cost from turn rows; expands
 * into per-agent and per-model tables. Renders nothing without usage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { FrameworkUsageEntry } from "../api/frameworkMetrics";

let mockRows: FrameworkUsageEntry[] = [];

vi.mock("../hooks/useSessionUsage", async () => {
  const { aggregateByCommand, aggregateByModel } = await import("../utils/frameworkAggregates");
  const actual = await vi.importActual<typeof import("../hooks/useSessionUsage")>(
    "../hooks/useSessionUsage",
  );
  return {
    ...actual,
    useSessionUsage: () => {
      let totalCostUsd = 0;
      let totalTokens = 0;
      for (const r of mockRows) {
        if (r.kind !== "turn") continue;
        totalCostUsd += r.cost_usd;
        totalTokens += r.input_tokens + r.output_tokens;
      }
      return {
        rows: mockRows,
        totalCostUsd,
        totalTokens,
        byCommand: aggregateByCommand(mockRows),
        byAgent: actual.deriveAgentLines(mockRows),
        byModel: aggregateByModel(mockRows),
      };
    },
  };
});

import { SessionUsageWidget } from "../components/SessionUsageWidget";

function row(overrides: Partial<FrameworkUsageEntry>): FrameworkUsageEntry {
  return {
    session_id: "s1",
    turn_uuid: "t1",
    kind: "turn",
    provider: "claude",
    model: "claude-sonnet-5",
    command: null,
    agent: "main",
    phase: null,
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    duration_ms: 1000,
    cost_usd: 0.5,
    ...overrides,
  };
}

describe("SessionUsageWidget", () => {
  afterEach(() => {
    cleanup();
    mockRows = [];
  });

  it("renders nothing when the session has no usage", () => {
    mockRows = [];
    render(<SessionUsageWidget sessionId="s1" />);
    expect(screen.queryByTestId("session-usage")).toBeNull();
  });

  it("shows totals from turn rows in the collapsed bar", () => {
    mockRows = [
      row({ turn_uuid: "t1", cost_usd: 0.5, input_tokens: 1000, output_tokens: 500 }),
      row({ turn_uuid: "t2", cost_usd: 0.25, input_tokens: 400, output_tokens: 100 }),
      // agent rows must NOT inflate totals (a turn already includes them)
      row({ kind: "agent", agent: "Build", cost_usd: 9.99, output_tokens: 99999 }),
    ];
    render(<SessionUsageWidget sessionId="s1" />);
    const bar = screen.getByRole("button", { name: /CONSUMO/ });
    expect(bar.textContent).toContain("$0.75");
    expect(bar.textContent).toContain("2.0k tokens");
  });

  it("expands into per-command, per-agent and per-model tables", () => {
    mockRows = [
      row({ turn_uuid: "t1", model: "claude-opus-4-8", cost_usd: 1.2, command: "harness-cmd:task" }),
      row({ kind: "agent", agent: "Build", output_tokens: 800 }),
      row({ kind: "agent", agent: "Reviewer", output_tokens: 300 }),
    ];
    render(<SessionUsageWidget sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /CONSUMO/ }));
    const detail = screen.getByTestId("session-usage-detail");
    // command executed
    expect(detail.textContent).toContain("harness-cmd:task");
    // main agent always listed, plus subagents
    expect(detail.textContent).toContain("main");
    expect(detail.textContent).toContain("Build");
    expect(detail.textContent).toContain("Reviewer");
    expect(detail.textContent).toContain("claude-opus-4-8");
  });

  it("a plain turn with no subagents still shows main + (prose) command", () => {
    mockRows = [row({ command: null })];
    render(<SessionUsageWidget sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /CONSUMO/ }));
    const detail = screen.getByTestId("session-usage-detail");
    expect(detail.textContent).toContain("(prose)");
    expect(detail.textContent).toContain("main");
  });
});
