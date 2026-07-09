/**
 * PipelineStrip — compact SDD pipeline readout pinned to the top of the
 * agent chat, so the workflow progress is always visible while the
 * agent runs.  Clicking it opens the full Pipeline tab in the Workbench.
 *
 * Render-gates itself: nothing renders until the session init confirms
 * the harness-cmd plugin is loaded — sessions without the framework see
 * no chrome at all.
 */
import "../styles/components/PipelineStrip.css";
import { useCallback } from "react";
import { useSession } from "../state/SessionContext";
import { usePipelineState } from "../hooks/usePipelineState";
import type { SessionData } from "../types/session";

const DOT: Record<string, string> = {
  done: "●",
  running: "◐",
  pending: "○",
};

export function PipelineStrip({ session }: { session: SessionData }) {
  const { dispatch } = useSession();
  const { phases, pluginPresent } = usePipelineState(session);

  const openPanel = useCallback(() => {
    dispatch({ type: "SET_WORKBENCH_OPEN", open: true });
    dispatch({ type: "SET_WORKBENCH_TAB", tab: "pipeline" });
  }, [dispatch]);

  if (!pluginPresent) return null;

  return (
    <button
      type="button"
      className="pipeline-strip"
      onClick={openPanel}
      title="Pipeline SDD — clique para abrir o painel"
      data-testid="pipeline-strip"
    >
      <span className="pipeline-strip-tag">PIPELINE</span>
      {phases.map((phase) => (
        <span
          key={phase.key}
          className={`pipeline-strip-phase is-${phase.status}`}
        >
          <span className="pipeline-strip-dot" aria-hidden="true">
            {DOT[phase.status]}
          </span>
          {phase.label}
        </span>
      ))}
    </button>
  );
}
