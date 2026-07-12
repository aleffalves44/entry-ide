/**
 * PipelineStrip — compact SDD pipeline readout pinned to the top of the
 * agent chat, so the workflow progress is always visible while the
 * agent runs.
 *
 * Each phase is a one-click trigger: clicking it opens an inline context
 * input (what the command needs — Jira key, description) and dispatches
 * the plugin's slash command through the normal chat, exactly like the
 * Workflow tab's panel.  The PIPELINE tag still opens the full Workflow
 * tab in the Workbench.
 *
 * Render-gates itself: nothing renders until the session init confirms
 * the harness-cmd plugin is loaded — sessions without the framework see
 * no chrome at all.
 */
import "../styles/components/PipelineStrip.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../state/SessionContext";
import { useWorkflowTimeline } from "../hooks/useWorkflowTimeline";
import { formatTokens } from "../utils/frameworkAggregates";
import { submitToAgent } from "../utils/submitToAgent";
import {
  PHASE_DESCRIPTIONS,
  PHASE_PLACEHOLDERS,
  type PhaseKey,
} from "../utils/pipelinePhases";
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
  const { phases, pluginPresent, timeline, isStreaming } =
    useWorkflowTimeline(session);
  const [activePhase, setActivePhase] = useState<PhaseKey | null>(null);
  // Per-phase context drafts — survive open/close so re-running a phase
  // with the same Jira key costs zero retyping (same contract as the panel).
  const [drafts, setDrafts] = useState<Partial<Record<PhaseKey, string>>>({});
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const openPanel = useCallback(() => {
    dispatch({ type: "SET_WORKBENCH_OPEN", open: true });
    dispatch({ type: "SET_WORKBENCH_TAB", tab: "workflow" });
  }, [dispatch]);

  const togglePhase = useCallback(
    (key: PhaseKey) => {
      if (isStreaming) return;
      setActivePhase((prev) => (prev === key ? null : key));
    },
    [isStreaming],
  );

  const dispatchPhase = useCallback(
    (key: PhaseKey) => {
      const phase = phases.find((p) => p.key === key);
      if (!phase || isStreaming) return;
      const arg = (drafts[key] ?? "").trim();
      const draft = arg ? `/${phase.command} ${arg}` : `/${phase.command}`;
      submitToAgent(session.id, draft, []).catch((e) =>
        console.warn("[PipelineStrip] dispatch failed:", e),
      );
      setActivePhase(null);
    },
    [phases, drafts, isStreaming, session.id],
  );

  // Close the context input on click-away or Escape.
  useEffect(() => {
    if (!activePhase) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePhase(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivePhase(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [activePhase]);

  if (!pluginPresent) return null;

  const fileCount = timeline.changedFileCount;
  const costSection = timeline.sections.find((s) => s.kind === "cost");
  const cost = costSection?.kind === "cost" ? costSection.cost : null;

  return (
    <div className="pipeline-strip-wrap" ref={popoverRef} data-testid="pipeline-strip">
      <div className="pipeline-strip">
        <button
          type="button"
          className="pipeline-strip-tag"
          onClick={openPanel}
          title="Abrir o acompanhamento de workflow"
        >
          PIPELINE
        </button>
        {phases.map((phase) => (
          <button
            key={phase.key}
            type="button"
            className={`pipeline-strip-phase is-${phase.status}${activePhase === phase.key ? " is-active" : ""}`}
            onClick={() => togglePhase(phase.key)}
            disabled={isStreaming}
            title={
              isStreaming
                ? "Aguarde o turno atual terminar"
                : PHASE_DESCRIPTIONS[phase.key]
            }
            aria-expanded={activePhase === phase.key}
          >
            <span className="pipeline-strip-dot" aria-hidden="true">
              {DOT[phase.status]}
            </span>
            {phase.label}
          </button>
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
      </div>

      {activePhase && (
        <div className="pipeline-strip-popover" data-testid="pipeline-strip-popover">
          <p className="pipeline-strip-popover-desc">
            {PHASE_DESCRIPTIONS[activePhase]}
          </p>
          <div className="pipeline-strip-popover-row">
            <input
              type="text"
              className="pipeline-strip-popover-input"
              value={drafts[activePhase] ?? ""}
              placeholder={PHASE_PLACEHOLDERS[activePhase]}
              autoFocus
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [activePhase]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dispatchPhase(activePhase);
                }
              }}
            />
            <button
              type="button"
              className="pipeline-strip-popover-send"
              onClick={() => dispatchPhase(activePhase)}
            >
              Executar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
