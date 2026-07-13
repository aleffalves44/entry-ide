/**
 * deliveryMetrics — pure lead-time math over delivery_events rows.
 *
 * Lead time = task_started → pr_opened per session (the slice the IDE
 * controls); the full cycle to pr_merged is shown as observed context.
 */
import type { DeliveryEvent } from "../api/delivery";

export interface DeliveryLine {
  sessionId: string;
  branch: string | null;
  repoPath: string | null;
  startedAt: string | null;
  prOpenedAt: string | null;
  prMergedAt: string | null;
  prUrl: string | null;
  /** task_started → pr_opened, ms.  Null while the PR isn't open. */
  leadMs: number | null;
  /** task_started → pr_merged, ms. */
  cycleMs: number | null;
}

function parseTs(s: string | null): number | null {
  if (!s) return null;
  // SQLite's datetime('now') has no timezone marker but IS UTC; gh
  // timestamps are proper ISO with Z.  Normalize the former.
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s.replace(" ", "T")}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function diffMs(from: string | null, to: string | null): number | null {
  const a = parseTs(from);
  const b = parseTs(to);
  if (a === null || b === null) return null;
  const d = b - a;
  return d >= 0 ? d : null;
}

/** Group raw events into one line per session, newest start first. */
export function deriveDeliveryLines(events: DeliveryEvent[]): DeliveryLine[] {
  const bySession = new Map<string, DeliveryLine>();
  for (const e of events) {
    let line = bySession.get(e.session_id);
    if (!line) {
      line = {
        sessionId: e.session_id,
        branch: null,
        repoPath: null,
        startedAt: null,
        prOpenedAt: null,
        prMergedAt: null,
        prUrl: null,
        leadMs: null,
        cycleMs: null,
      };
      bySession.set(e.session_id, line);
    }
    line.branch = line.branch ?? e.branch;
    line.repoPath = line.repoPath ?? e.repo_path;
    if (e.event === "task_started") line.startedAt = e.recorded_at;
    if (e.event === "pr_opened") {
      line.prOpenedAt = e.recorded_at;
      line.prUrl = e.pr_url ?? line.prUrl;
    }
    if (e.event === "pr_merged") line.prMergedAt = e.recorded_at;
  }
  const lines = [...bySession.values()];
  for (const l of lines) {
    l.leadMs = diffMs(l.startedAt, l.prOpenedAt);
    l.cycleMs = diffMs(l.startedAt, l.prMergedAt);
  }
  return lines.sort((a, b) => (parseTs(b.startedAt) ?? 0) - (parseTs(a.startedAt) ?? 0));
}

export interface PendingMergeCheck {
  sessionId: string;
  repoPath: string;
  prNumber: number;
  prUrl: string | null;
  branch: string | null;
}

/** Lines whose PR is open with no merge recorded — the set worth asking
 *  gh about when the Consumo Geral view opens.  Requires repo path and
 *  PR number (without either, there's nothing actionable to query). */
export function pendingMergeChecks(
  events: DeliveryEvent[],
): PendingMergeCheck[] {
  const prNumbers = new Map<string, number>();
  for (const e of events) {
    if (e.event === "pr_opened" && e.pr_number !== null) {
      prNumbers.set(e.session_id, e.pr_number);
    }
  }
  return deriveDeliveryLines(events)
    .filter((l) => l.prOpenedAt !== null && l.prMergedAt === null && l.repoPath)
    .flatMap((l) => {
      const prNumber = prNumbers.get(l.sessionId);
      if (prNumber === undefined) return [];
      return [{
        sessionId: l.sessionId,
        repoPath: l.repoPath!,
        prNumber,
        prUrl: l.prUrl,
        branch: l.branch,
      }];
    });
}

export function medianLeadMs(lines: DeliveryLine[]): number | null {
  const leads = lines
    .map((l) => l.leadMs)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (leads.length === 0) return null;
  const mid = Math.floor(leads.length / 2);
  return leads.length % 2 === 1 ? leads[mid] : (leads[mid - 1] + leads[mid]) / 2;
}

export function formatLead(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
