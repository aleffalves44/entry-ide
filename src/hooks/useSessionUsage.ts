/**
 * useSessionUsage — this session's framework_usage rows, refreshed when a
 * turn completes (same `resultEventAt` edge as usePipelineState).  Feeds
 * the inline SessionUsageWidget with per-agent / per-model breakdowns.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { peekAgentSessionStore } from "../agent/agentSessionStore";
import { getFrameworkUsage, type FrameworkUsageEntry } from "../api/frameworkMetrics";
import {
  aggregateByAgent,
  aggregateByModel,
  type AgentAggregate,
  type ModelAggregate,
} from "../utils/frameworkAggregates";

const EMPTY_SNAPSHOT = null;

export interface SessionUsage {
  rows: FrameworkUsageEntry[];
  /** Totals from turn rows (a turn already includes its subagents). */
  totalCostUsd: number;
  totalTokens: number;
  byAgent: AgentAggregate[];
  byModel: ModelAggregate[];
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
        if (!cancelled) setRows(r);
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
      byAgent: aggregateByAgent(rows),
      byModel: aggregateByModel(rows),
    };
  }, [rows]);
}
