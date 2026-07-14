// ─── Delivery events API (M5 — lead-time metrics) ────────────────────
//
// Milestones of a task's journey (task_started → first_commit →
// pr_opened → pr_merged), persisted in the local `delivery_events`
// table.  Recording is idempotent — the backend dedupes on
// (session_id, event, pr_number) — so capture points can fire on every
// pipeline refresh without double counting.
import { invoke } from "@tauri-apps/api/core";

export type DeliveryEventKind =
  | "task_started"
  | "first_commit"
  | "pr_opened"
  | "pr_merged";

export interface DeliveryEvent {
  session_id: string;
  repo_path: string | null;
  branch: string | null;
  event: DeliveryEventKind;
  pr_number: number | null;
  pr_url: string | null;
  /** ISO timestamp of the milestone.  Omit/null = backend stamps now. */
  recorded_at: string | null;
}

export function recordDeliveryEvent(event: DeliveryEvent): Promise<boolean> {
  return invoke("record_delivery_event", { event });
}

export function getDeliveryEvents(since?: string): Promise<DeliveryEvent[]> {
  return invoke("get_delivery_events", { since: since ?? null });
}

/** On-demand merge check for a specific PR (delivery metrics).  Returns
 *  gh's exact mergedAt when merged, null otherwise/on any failure. */
export function checkPrMerged(
  repoPath: string,
  prNumber: number,
): Promise<string | null> {
  return invoke("check_pr_merged", { repoPath, prNumber });
}
