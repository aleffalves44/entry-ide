/**
 * Pure aggregations over `framework_usage` rows for the Framework view
 * of the Cost Dashboard.
 *
 * Row-kind semantics (see src/agent/frameworkMetrics.ts):
 *   `turn`  rows are authoritative totals — cost/token sums use ONLY them.
 *   `agent` rows are a per-subagent breakdown (output tokens are additive
 *           within the kind, but NOT with `turn` rows).
 *   `model` rows split multi-model turns; single-model turns have none,
 *           so per-model views fall back to the turn row's model.
 */
import type { FrameworkUsageEntry } from "../api/frameworkMetrics";

export interface CommandAggregate {
  command: string;
  turns: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  avgDurationMs: number | null;
  avgCostUsd: number;
}

export interface AgentAggregate {
  agent: string;
  runs: number;
  outputTokens: number;
  /** in + out + cache_write + cache_read — the billed volume. */
  totalTokens: number;
  costUsd: number;
}

export interface ModelAggregate {
  model: string;
  turns: number;
  costUsd: number;
  outputTokens: number;
}

export const PROSE_COMMAND = "(prose)";

export function aggregateByCommand(rows: FrameworkUsageEntry[]): CommandAggregate[] {
  const map = new Map<string, CommandAggregate & { durTotal: number; durCount: number }>();
  for (const r of rows) {
    if (r.kind !== "turn") continue;
    const key = r.command ?? PROSE_COMMAND;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        command: key,
        turns: 0,
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        avgDurationMs: null,
        avgCostUsd: 0,
        durTotal: 0,
        durCount: 0,
      };
      map.set(key, agg);
    }
    agg.turns += 1;
    agg.costUsd += r.cost_usd;
    agg.inputTokens += r.input_tokens;
    agg.outputTokens += r.output_tokens;
    agg.cacheReadTokens += r.cache_read_tokens;
    if (typeof r.duration_ms === "number") {
      agg.durTotal += r.duration_ms;
      agg.durCount += 1;
    }
  }
  return [...map.values()]
    .map(({ durTotal, durCount, ...agg }) => ({
      ...agg,
      avgDurationMs: durCount > 0 ? durTotal / durCount : null,
      avgCostUsd: agg.turns > 0 ? agg.costUsd / agg.turns : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

export function aggregateByAgent(rows: FrameworkUsageEntry[]): AgentAggregate[] {
  const map = new Map<string, AgentAggregate>();
  for (const r of rows) {
    if (r.kind !== "agent") continue;
    let agg = map.get(r.agent);
    if (!agg) {
      agg = { agent: r.agent, runs: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
      map.set(r.agent, agg);
    }
    agg.runs += 1;
    agg.outputTokens += r.output_tokens;
    agg.totalTokens +=
      r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_creation_tokens;
    agg.costUsd += r.cost_usd;
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

export function aggregateByModel(rows: FrameworkUsageEntry[]): ModelAggregate[] {
  const map = new Map<string, ModelAggregate>();
  for (const r of rows) {
    if (r.kind !== "turn") continue;
    let agg = map.get(r.model);
    if (!agg) {
      agg = { model: r.model, turns: 0, costUsd: 0, outputTokens: 0 };
      map.set(r.model, agg);
    }
    agg.turns += 1;
    agg.costUsd += r.cost_usd;
    agg.outputTokens += r.output_tokens;
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd);
}

/** `1234` → "1.2k", `12_345_678` → "12.3M".  Dashboard-density format. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** `125_000` ms → "2m05s"; `8_000` → "8s". */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m${String(sec).padStart(2, "0")}s`;
}

/** ISO date (YYYY-MM-DD) N days ago — matches SQLite's datetime('now')
 *  lexicographic ordering for the `since` filter. */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
