/**
 * Pipeline panel — SDD workflow (spike → plan → task → pr) as a
 * Workbench tab for agent sessions.
 *
 * Design contract (docs/FEATURE-PLAN.md, Fase 2):
 *   • Phase state is DERIVED from the worktree (files + git + gh) via
 *     `get_pipeline_state` — the panel never tracks its own progress, so
 *     it survives restarts and reflects out-of-band work.
 *   • Dispatching a phase sends the plugin's slash command through the
 *     normal chat (`submitToAgent`) — identical to typing it.  The panel
 *     is a shortcut, not a second execution path.
 *   • The workflow lives in the `harness-cmd` Claude Code plugin.  When
 *     the plugin isn't loaded, the panel degrades to setup instructions.
 */
import "../styles/components/PipelinePanel.css";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../state/SessionContext";
import { getSessionProjects } from "../api/projects";
import { submitToAgent } from "../utils/submitToAgent";
import { usePipelineState } from "../hooks/usePipelineState";
import {
  formatPhaseDetail,
  type PhaseKey,
  type PipelinePhase,
} from "../utils/pipelinePhases";
import { useWorkflowRunner } from "../hooks/useWorkflowRunner";
import { PHASE_ORDER } from "../utils/workflowRunner";
import { useTranslation } from "../hooks/useTranslation";
import type { MessageKey } from "../i18n";
import type { SessionData } from "../types/session";

interface PipelinePanelProps {
  session: SessionData;
}

interface PhaseExpandedSectionProps {
  phase: PipelinePhase;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

function PhaseExpandedSection({
  phase,
  draft,
  onDraftChange,
  onSend,
  disabled,
}: PhaseExpandedSectionProps) {
  const { t } = useTranslation();
  return (
    <div
      className="pipeline-phase-expanded"
      // Defensive: keep clicks inside the expanded section (input focus,
      // text selection, send) from ever reaching the row toggle.
      onClick={(e) => e.stopPropagation()}
    >
      <p className="pipeline-phase-description">
        {t(`pipeline.desc.${phase.key}` as MessageKey)}
      </p>
      <input
        type="text"
        className="pipeline-phase-input"
        value={draft}
        placeholder={t(`pipeline.placeholder.${phase.key}` as MessageKey)}
        disabled={disabled}
        autoFocus
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !disabled) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button
        type="button"
        className="pipeline-phase-send"
        onClick={onSend}
        disabled={disabled}
      >
        {t("common.send")}
      </button>
    </div>
  );
}

export function PipelinePanel({ session }: PipelinePanelProps) {
  const { dispatch } = useSession();
  const { t } = useTranslation();
  const { phases, pipeline, loading, refresh, isStreaming, pluginMissing } =
    usePipelineState(session);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<PhaseKey | null>(null);
  // Per-phase context drafts.  Persist across accordion toggles and after
  // send, so re-running a phase with the same Jira key costs zero retyping.
  const [drafts, setDrafts] = useState<Partial<Record<PhaseKey, string>>>({});
  // Shared task context for the "Rodar workflow" chaining runner — appended
  // to every chained phase's slash command, same contract as the Workflow
  // timeline used before unification.
  const [taskInput, setTaskInput] = useState("");
  const runner = useWorkflowRunner(session, taskInput);

  // Project id for the artifact → FilePreview handoff.
  useEffect(() => {
    let cancelled = false;
    getSessionProjects(session.id)
      .then((ps) => {
        if (!cancelled) setProjectId(ps[0]?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  const dispatchPhase = useCallback(
    (command: string, context: string) => {
      const arg = context.trim();
      const draft = arg ? `/${command} ${arg}` : `/${command}`;
      submitToAgent(session.id, draft, []).catch((e) =>
        console.warn("[PipelinePanel] dispatch failed:", e),
      );
    },
    [session.id],
  );

  const togglePhase = useCallback(
    (key: PhaseKey) => {
      if (isStreaming) return;
      setActivePhase((prev) => (prev === key ? null : key));
    },
    [isStreaming],
  );

  const openArtifact = useCallback(
    (path: string) => {
      if (!projectId) return;
      dispatch({ type: "SET_FILE_PREVIEW", projectId, filePath: path });
    },
    [dispatch, projectId],
  );

  if (pluginMissing) {
    return (
      <div className="pipeline-panel" data-testid="pipeline-panel">
        <div className="pipeline-empty">
          <div className="pipeline-empty-title">{t("pipeline.pluginMissingTitle")}</div>
          <p className="pipeline-empty-body">
            {t("pipeline.pluginMissingBodyBefore")}
            <code>agentic-harness</code>
            {t("pipeline.pluginMissingBodyAfter")}
          </p>
          <code className="pipeline-empty-cmd">/plugin install harness-cmd</code>
        </div>
      </div>
    );
  }

  return (
    <div className="pipeline-panel" data-testid="pipeline-panel">
      <div className="pipeline-toolbar">
        {pipeline?.branch && (
          <span className="pipeline-branch" title={t("pipeline.branchTitle")}>
            {pipeline.branch}
          </span>
        )}
        <button
          type="button"
          className="pipeline-refresh"
          onClick={refresh}
          disabled={loading}
          title={t("pipeline.refreshTitle")}
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {/* "Rodar workflow" chaining controls — run / approve / cancel +
          per-phase approval-stop toggles.  Brought over from the unified
          Workflow tab when the two were merged into this Pipeline view. */}
      <div className="workflow-runner" data-testid="workflow-runner">
        <button
          type="button"
          className="workflow-runner-run"
          onClick={runner.start}
          disabled={runner.state.running && !runner.state.awaitingApproval}
          title={t("workflow.chainTitle")}
        >
          {runner.state.running && !runner.state.awaitingApproval
            ? t("workflow.chaining")
            : t("workflow.run")}
        </button>
        {runner.state.awaitingApproval && (
          <button
            type="button"
            className="workflow-runner-approve"
            onClick={runner.approve}
            title={t("workflow.approveTitle", {
              phase: phases.find((p) => p.key === runner.state.awaitingApproval)?.label ?? "",
            })}
          >
            {t("workflow.approve", {
              phase: phases.find((p) => p.key === runner.state.awaitingApproval)?.label ?? "",
            })}
          </button>
        )}
        {runner.state.running && (
          <button
            type="button"
            className="workflow-runner-cancel"
            onClick={runner.cancel}
            title={t("workflow.cancelTitle")}
          >
            {t("workflow.cancel")}
          </button>
        )}
        <div className="workflow-runner-stops" title={t("workflow.stopsTitle")}>
          {PHASE_ORDER.map((key) => (
            <label
              key={key}
              className={`workflow-stop ${runner.stopAfter.has(key) ? "is-on" : ""}`}
            >
              <input
                type="checkbox"
                checked={runner.stopAfter.has(key)}
                onChange={() => runner.toggleStop(key)}
              />
              {phases.find((p) => p.key === key)?.label ?? key}
            </label>
          ))}
        </div>
        {runner.state.awaitingApproval && (
          <div className="workflow-runner-awaiting">
            {t("workflow.awaiting", {
              phase: phases.find((p) => p.key === runner.state.awaitingApproval)?.label ?? "",
            })}
          </div>
        )}
      </div>

      <input
        type="text"
        className="workflow-task-input"
        value={taskInput}
        onChange={(e) => setTaskInput(e.target.value)}
        placeholder={t("workflow.taskPlaceholder")}
        title={t("workflow.taskInputTitle")}
        spellCheck={false}
      />

      <ol className="pipeline-phases">
        {phases.map((phase) => (
          <li key={phase.key} className={`pipeline-phase is-${phase.status}`}>
            <div
              className="pipeline-phase-row"
              role="button"
              tabIndex={0}
              aria-expanded={activePhase === phase.key}
              aria-disabled={isStreaming ? true : undefined}
              onClick={() => togglePhase(phase.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  togglePhase(phase.key);
                }
              }}
            >
              <span className="pipeline-phase-dot" aria-hidden="true">
                {phase.status === "done" ? "●" : phase.status === "running" ? "◐" : "○"}
              </span>
              <span className="pipeline-phase-label">{phase.label}</span>
              <span className="pipeline-phase-status">
                {phase.status === "done"
                  ? t("phase.done")
                  : phase.status === "running"
                    ? t("phase.running")
                    : ""}
              </span>
            </div>

            {activePhase === phase.key && (
              <PhaseExpandedSection
                phase={phase}
                draft={drafts[phase.key] ?? ""}
                onDraftChange={(value) =>
                  setDrafts((prev) => ({ ...prev, [phase.key]: value }))
                }
                onSend={() => dispatchPhase(phase.command, drafts[phase.key] ?? "")}
                disabled={isStreaming}
              />
            )}

            {phase.detail && (
              <div className="pipeline-phase-detail">
                {formatPhaseDetail(phase.detail, t)}
              </div>
            )}

            {phase.artifacts.length > 0 && (
              <div className="pipeline-phase-artifacts">
                {phase.artifacts.map((a) => (
                  <button
                    key={a.path}
                    type="button"
                    className="pipeline-artifact"
                    onClick={(e) => {
                      e.stopPropagation();
                      openArtifact(a.path);
                    }}
                    title={a.path}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <p className="pipeline-hint">
        {t("pipeline.hintBefore")}
        <code>/harness-cmd:…</code>
        {t("pipeline.hintAfter")}
      </p>
    </div>
  );
}
