/**
 * WorkflowTimelinePanel — the unified "Workflow" tab in the Workbench.
 *
 * Renders, in one chronological column, the pieces today spread across the
 * Pipeline / Files / Git / Metrics tabs:
 *   • the four SDD phases (status dot + per-phase ▶),
 *   • generated `.md` artifacts (clickable → markdown preview),
 *   • changed git files (clickable → diff view),
 *   • token/cost of the running phase,
 * plus the "Rodar workflow" chaining controls (play / approve / cancel +
 * per-phase approval-stop toggles).
 *
 * Reuses existing hooks/utilities (`useWorkflowTimeline`,
 * `useWorkflowRunner`) and existing dispatch primitives (`submitToAgent`,
 * `SET_FILE_PREVIEW`, `GitDiffView`) — no second execution path, no new
 * pipeline tracking.  Render-gates on plugin presence like `PipelinePanel`.
 */
import "../styles/components/WorkflowTimelinePanel.css";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../state/SessionContext";
import { getSessionProjects } from "../api/projects";
import { submitToAgent } from "../utils/submitToAgent";
import { useWorkflowTimeline } from "../hooks/useWorkflowTimeline";
import { useWorkflowRunner } from "../hooks/useWorkflowRunner";
import { GitDiffView } from "./GitDiffView";
import { formatDuration, formatTokens } from "../utils/frameworkAggregates";
import { useTranslation } from "../hooks/useTranslation";
import type { Translation } from "../hooks/useTranslation";
import type { GitFile } from "../types/git";
import type { SessionData } from "../types/session";
import type { TimelineSection } from "../utils/workflowTimeline";
import { formatPhaseDetail, type PhaseKey } from "../utils/pipelinePhases";
import { PHASE_ORDER } from "../utils/workflowRunner";

const DOT: Record<string, string> = {
  done: "●",
  running: "◐",
  pending: "○",
};

const PHASE_LABEL: Record<PhaseKey, string> = {
  spike: "Spike",
  plan: "Plan",
  task: "Task",
  pr: "PR",
};

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

interface WorkflowTimelinePanelProps {
  session: SessionData;
}

export function WorkflowTimelinePanel({ session }: WorkflowTimelinePanelProps) {
  const { dispatch } = useSession();
  const { t } = useTranslation();
  const { timeline, loading, isStreaming, pluginMissing, pluginPresent, refresh } =
    useWorkflowTimeline(session);

  // Task context shared by manual dispatch and the runner.
  const [taskInput, setTaskInput] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [diffTarget, setDiffTarget] = useState<{
    file: GitFile;
  } | null>(null);

  const runner = useWorkflowRunner(session, taskInput);

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
    (command: string) => {
      const args = taskInput.trim();
      const draft = args.length > 0 ? `/${command} ${args}` : `/${command}`;
      submitToAgent(session.id, draft, []).catch((e) =>
        console.warn("[WorkflowTimeline] dispatch failed:", e),
      );
    },
    [session.id, taskInput],
  );

  const openArtifact = useCallback(
    (path: string) => {
      if (!projectId) return;
      dispatch({ type: "SET_FILE_PREVIEW", projectId, filePath: path });
    },
    [dispatch, projectId],
  );

  const openDiff = useCallback((file: GitFile) => {
    setDiffTarget({ file });
  }, []);

  if (pluginMissing) {
    return (
      <div className="workflow-panel" data-testid="workflow-panel">
        <div className="workflow-empty">
          <div className="workflow-empty-title">{t("pipeline.pluginMissingTitle")}</div>
          <p className="workflow-empty-body">
            {t("workflow.pluginMissingBodyBefore")}
            <code>agentic-harness</code>
            {t("workflow.pluginMissingBodyAfter")}
          </p>
          <code className="workflow-empty-cmd">/plugin install harness-cmd</code>
        </div>
      </div>
    );
  }

  if (!pluginPresent) {
    // Init hasn't arrived yet — nothing to show, no setup nudge either.
    return (
      <div className="workflow-panel" data-testid="workflow-panel">
        <div className="workflow-empty">
          <div className="workflow-empty-title">{t("workflow.waitingTitle")}</div>
          <p className="workflow-empty-body">
            {t("workflow.waitingBodyBefore")}
            <code>harness-cmd</code>
            {t("workflow.waitingBodyAfter")}
          </p>
        </div>
      </div>
    );
  }

  const { state: runnerState } = runner;
  const runnerActive = runnerState.running;
  const awaiting = runnerState.awaitingApproval;

  return (
    <div className="workflow-panel" data-testid="workflow-panel">
      <div className="workflow-toolbar">
        <span className="workflow-toolbar-tag">{t("workflow.tag")}</span>
        <button
          type="button"
          className="workflow-refresh"
          onClick={refresh}
          disabled={loading}
          title={t("workflow.refreshTitle")}
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {/* "Run workflow" controls */}
      <div className="workflow-runner" data-testid="workflow-runner">
        <button
          type="button"
          className="workflow-runner-run"
          onClick={runner.start}
          disabled={runnerActive && !awaiting}
          title={t("workflow.chainTitle")}
        >
          {runnerActive && !awaiting ? t("workflow.chaining") : t("workflow.run")}
        </button>
        {awaiting && (
          <button
            type="button"
            className="workflow-runner-approve"
            onClick={runner.approve}
            title={t("workflow.approveTitle", { phase: PHASE_LABEL[awaiting] })}
          >
            {t("workflow.approve", { phase: PHASE_LABEL[awaiting] })}
          </button>
        )}
        {runnerActive && (
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
            <label key={key} className={`workflow-stop ${runner.stopAfter.has(key) ? "is-on" : ""}`}>
              <input
                type="checkbox"
                checked={runner.stopAfter.has(key)}
                onChange={() => runner.toggleStop(key)}
              />
              {PHASE_LABEL[key]}
            </label>
          ))}
        </div>
        {awaiting && (
          <div className="workflow-runner-awaiting">
            {t("workflow.awaiting", { phase: PHASE_LABEL[awaiting] })}
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

      <div className="workflow-timeline">
        {timeline.sections.map((section, i) => (
          <TimelineSectionView
            key={i}
            section={section}
            isStreaming={isStreaming}
            t={t}
            onRun={dispatchPhase}
            onOpenArtifact={openArtifact}
            onOpenDiff={openDiff}
          />
        ))}
        {timeline.sections.length === 0 && (
          <div className="workflow-empty">
            <p className="workflow-empty-body">{t("workflow.emptyTimeline")}</p>
          </div>
        )}
      </div>

      <p className="workflow-hint">{t("workflow.hint")}</p>

      {diffTarget && projectId && (
        <GitDiffView
          sessionId={session.id}
          projectId={projectId}
          file={diffTarget.file}
          onClose={() => setDiffTarget(null)}
        />
      )}
    </div>
  );
}

function TimelineSectionView({
  section,
  isStreaming,
  t,
  onRun,
  onOpenArtifact,
  onOpenDiff,
}: {
  section: TimelineSection;
  isStreaming: boolean;
  t: Translation["t"];
  onRun: (command: string) => void;
  onOpenArtifact: (path: string) => void;
  onOpenDiff: (file: GitFile) => void;
}) {
  if (section.kind === "phase") {
    const phase = section.phase;
    return (
      <div className={`workflow-section workflow-phase is-${phase.status}`}>
        <div className="workflow-phase-row">
          <span className="workflow-phase-dot" aria-hidden="true">
            {DOT[phase.status]}
          </span>
          <span className="workflow-phase-label">{phase.label}</span>
          <span className="workflow-phase-status">
            {phase.status === "done"
              ? t("phase.done")
              : phase.status === "running"
                ? t("phase.running")
                : t("phase.pending")}
          </span>
          <button
            type="button"
            className="workflow-phase-run"
            onClick={() => onRun(phase.command)}
            disabled={isStreaming}
            title={t("workflow.runPhaseTitle", { command: phase.command })}
          >
            ▶
          </button>
        </div>
        {phase.detail && (
          <div className="workflow-phase-detail">{formatPhaseDetail(phase.detail, t)}</div>
        )}
      </div>
    );
  }

  if (section.kind === "artifacts") {
    return (
      <div className="workflow-section workflow-artifacts">
        <div className="workflow-section-title">{t("workflow.artifactsTitle")}</div>
        <div className="workflow-artifact-list">
          {section.items.map((a) => (
            <button
              key={a.path}
              type="button"
              className="workflow-artifact"
              onClick={() => onOpenArtifact(a.path)}
              title={a.path}
            >
              <span className="workflow-artifact-phase">{PHASE_LABEL[a.phase]}</span>
              <span className="workflow-artifact-label">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (section.kind === "files") {
    return (
      <div className="workflow-section workflow-files">
        <div className="workflow-section-title">
          {t("workflow.filesTitle", { count: section.files.length })}
        </div>
        <ul className="workflow-file-list">
          {section.files.map((f) => (
            <li key={`${f.area}:${f.path}`} className={`workflow-file is-${f.status}`}>
              <button
                type="button"
                className="workflow-file-btn"
                onClick={() => onOpenDiff(f)}
                title={t("workflow.openDiffTitle", { area: f.area })}
              >
                <span className="workflow-file-status">{f.status[0].toUpperCase()}</span>
                <span className="workflow-file-path">{f.path}</span>
                <span className="workflow-file-area">{f.area}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // cost
  const cost = section.cost;
  const phaseLabel = cost.phase ? PHASE_LABEL[cost.phase] : t("workflow.costTurn");
  return (
    <div className="workflow-section workflow-cost">
      <div className="workflow-section-title">{t("workflow.costTitle", { phase: phaseLabel })}</div>
      <div className="workflow-cost-grid">
        <span className="workflow-cost-cell">
          <span className="workflow-cost-k">{t("workflow.cost.turns")}</span>
          <span className="workflow-cost-v">{cost.turns}</span>
        </span>
        <span className="workflow-cost-cell">
          <span className="workflow-cost-k">{t("workflow.cost.tokens")}</span>
          <span className="workflow-cost-v mono">
            {formatTokens(cost.inputTokens + cost.outputTokens)}
          </span>
        </span>
        <span className="workflow-cost-cell">
          <span className="workflow-cost-k">{t("workflow.cost.duration")}</span>
          <span className="workflow-cost-v mono">{formatDuration(cost.durationMs)}</span>
        </span>
        <span className="workflow-cost-cell">
          <span className="workflow-cost-k">{t("workflow.cost.cost")}</span>
          <span className="workflow-cost-v mono">{formatCost(cost.costUsd)}</span>
        </span>
      </div>
    </div>
  );
}