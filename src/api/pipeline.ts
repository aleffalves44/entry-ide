// ─── SDD pipeline state API ───────────────────────────────────────────
//
// Thin wrapper over the `get_pipeline_state` Tauri command.  State is
// derived from the worktree (files + git + gh) on every call — nothing
// is cached backend-side, so callers own their refresh cadence.
import { invoke } from "@tauri-apps/api/core";
import type { PipelineState } from "../utils/pipelinePhases";

export function getPipelineState(workingDir: string): Promise<PipelineState> {
  return invoke("get_pipeline_state", { workingDir });
}
