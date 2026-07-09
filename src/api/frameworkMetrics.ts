// ─── Framework metrics API ────────────────────────────────────────────
//
// Read side of the `framework_usage` table (writes happen in
// `src/agent/frameworkMetrics.ts`, wired into the agent session store).
// Raw rows come back newest-first; aggregation happens in the caller so
// every dashboard view works off one query shape.
import { invoke } from "@tauri-apps/api/core";
import type { FrameworkUsageRow } from "../agent/frameworkMetrics";

export interface FrameworkUsageEntry extends FrameworkUsageRow {
  recorded_at?: string | null;
}

/** Raw usage rows, optionally filtered by ISO date (`since`) and session. */
export function getFrameworkUsage(opts?: {
  since?: string;
  sessionId?: string;
}): Promise<FrameworkUsageEntry[]> {
  return invoke("get_framework_usage", {
    since: opts?.since ?? null,
    sessionId: opts?.sessionId ?? null,
  });
}

/** Write every row (optionally since an ISO date) as JSONL to `path`.
 *  Returns the number of rows exported. */
export function exportFrameworkUsage(path: string, since?: string): Promise<number> {
  return invoke("export_framework_usage", { path, since: since ?? null });
}
