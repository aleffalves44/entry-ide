/**
 * PipelineStrip — compact SDD pipeline readout pinned to the top of the
 * agent chat, so the workflow progress is always visible while the
 * agent runs.  Clicking it opens the unified Workflow tab in the Workbench.
 *
 * When the harness-cmd plugin is loaded the strip also shows a compact
 * changed-files count and the running phase's token/cost chip — the same
 * facts the Workflow tab composes — so the user can track a task without
 * opening the Workbench.
 *
 * Render-gates itself: nothing renders until the session init confirms
 * the harness-cmd plugin is loaded — sessions without the framework see
 * no chrome at all.
 */
import "../styles/components/PipelineStrip.css";
import { useCallback } from "react";
import { useSession } from "../state/SessionContext";
import { useWorkflowTimeline } from "../hooks/useWorkflowTimeline";
import { formatTokens } from "../utils/frameworkAggregates";
import type { SessionData } from "../types/session";

const DOT: Record<string, string> = {
  done: "●",
  running: "◐",
  pending: "○",
};

function formatCostShort(n: number): string {
  if (n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function PipelineStrip({ session }: { session: SessionData }) {
  const { dispatch } = useSession();
  const { phases, pluginPresent, timeline } = useWorkflowTimeline(session);

  const openPanel = useCallback(() => {
    dispatch({ type: "SET_WORKBENCH_OPEN", open: true });
    dispatch({ type: "SET_WORKBENCH_TAB", tab: "workflow" });
  }, [dispatch]);

  if (!pluginPresent) return null;

  const fileCount = timeline.changedFileCount;
  const costSection = timeline.sections.find((s) => s.kind === "cost");
  const cost = costSection?.kind === "cost" ? costSection.cost : null;

  return (
    <button
      type="button"
      className="pipeline-strip"
      onClick={openPanel}
      title="Pipeline SDD — clique para abrir o acompanhamento de workflow"
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
      {fileCount > 0 && (
        <span
          className="pipeline-strip-meta"
          title={`${fileCount} arquivo(s) alterado(s)`}
        >
          {fileCount} {fileCount === 1 ? "arquivo" : "arquivos"}
        </span>
      )}
      {cost && (cost.turns > 0 || cost.costUsd > 0) && (
        <span
          className="pipeline-strip-meta pipeline-strip-cost"
          title={`Custo da fase · ${formatTokens(cost.inputTokens + cost.outputTokens)} tokens`}
        >
          {formatTokens(cost.inputTokens + cost.outputTokens)} · {formatCostShort(cost.costUsd)}
        </span>
      )}
    </button>
  );
}
