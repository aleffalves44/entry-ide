/**
 * useSessionUsage — this session's framework_usage rows, refreshed when a
 * turn completes (same `resultEventAt` edge as usePipelineState).  Feeds
 * the inline SessionUsageWidget with per-command / per-agent / per-model
 * breakdowns.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { peekAgentSessionStore } from "../agent/agentSessionStore";
import { getFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import {
  aggregateByCommand,
  aggregateByModel,
  type CommandAggregate,
  type ModelAggregate,
} from "../utils/frameworkAggregates";

const EMPTY_SNAPSHOT = null;

/** Per-agent line including the main agent (derived from turn rows —
 *  note a turn's totals INCLUDE its subagents, so main ⊇ subagents;
 *  the lines show relative weight, not disjoint partitions). */
export interface SessionAgentLine {
  agent: string;
  runs: number;
  outputTokens: number;
  costUsd: number;
}

export interface SessionUsage {
  rows: FrameworkUsageEntry[];
  /** Totals from turn rows (a turn already includes its subagents). */
  totalCostUsd: number;
  totalTokens: number;
  byCommand: CommandAggregate[];
  byAgent: SessionAgentLine[];
  byModel: ModelAggregate[];
}

export function deriveAgentLines(rows: FrameworkUsageEntry[]): SessionAgentLine[] {
  const main: SessionAgentLine = { agent: "main", runs: 0, outputTokens: 0, costUsd: 0 };
  const subs = new Map<string, SessionAgentLine>();
  for (const r of rows) {
    if (r.kind === "turn") {
      main.runs += 1;
      main.outputTokens += r.output_tokens;
      main.costUsd += r.cost_usd;
    } else if (r.kind === "agent") {
      let line = subs.get(r.agent);
      if (!line) {
        line = { agent: r.agent, runs: 0, outputTokens: 0, costUsd: 0 };
        subs.set(r.agent, line);
      }
      line.runs += 1;
      line.outputTokens += r.output_tokens;
      line.costUsd += r.cost_usd;
    }
  }
  const sorted = [...subs.values()].sort((a, b) => b.outputTokens - a.outputTokens);
  return main.runs > 0 ? [main, ...sorted] : sorted;
}

export function useSessionUsage(sessionId: string): SessionUsage {
  const store = peekAgentSessionStore(sessionId);
  const snapshot = useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    () => (store ? store.getSnapshot() : EMPTY_SNAPSHOT),
  );
  const resultEventAt = snapshot?.state.resultEventAt ?? null;

  const [rows, setRows] = useState<FrameworkUsageEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFrameworkUsage({ sessionId })
      .then((r) => {
        // Defensive: a mocked/failed IPC can resolve to a non-array —
        // keep the empty list rather than crashing the pane render.
        if (!cancelled && Array.isArray(r)) setRows(r);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, resultEventAt]);

  return useMemo(() => {
    let totalCostUsd = 0;
    let totalTokens = 0;
    for (const r of rows) {
      if (r.kind !== "turn") continue;
      totalCostUsd += r.cost_usd;
      totalTokens += r.input_tokens + r.output_tokens;
    }
    return {
      rows,
      totalCostUsd,
      totalTokens,
      byCommand: aggregateByCommand(rows),
      byAgent: deriveAgentLines(rows),
      byModel: aggregateByModel(rows),
    };
  }, [rows]);
}
