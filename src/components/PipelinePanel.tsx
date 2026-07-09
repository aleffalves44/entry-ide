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
  PHASE_DESCRIPTIONS,
  type PhaseKey,
  type PipelinePhase,
} from "../utils/pipelinePhases";
import type { SessionData } from "../types/session";

interface PipelinePanelProps {
  session: SessionData;
}

interface PhaseExpandedSectionProps {
  phase: PipelinePhase;
  onSend: () => void;
  disabled: boolean;
}

function PhaseExpandedSection({ phase, onSend, disabled }: PhaseExpandedSectionProps) {
  return (
    <div className="pipeline-phase-expanded">
      <p className="pipeline-phase-description">{PHASE_DESCRIPTIONS[phase.key]}</p>
      <button
        type="button"
        className="pipeline-phase-send"
        onClick={(e) => {
          // Defensive: keep the send click from ever reaching the row toggle,
          // mirroring the artifact-button pattern.
          e.stopPropagation();
          onSend();
        }}
        disabled={disabled}
      >
        Enviar
      </button>
    </div>
  );
}

export function PipelinePanel({ session }: PipelinePanelProps) {
  const { dispatch } = useSession();
  const { phases, pipeline, loading, refresh, isStreaming, pluginMissing } =
    usePipelineState(session);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<PhaseKey | null>(null);

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
    (command: string) => {
      const draft = `/${command}`;
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
          <div className="pipeline-empty-title">Plugin harness-cmd não encontrado</div>
          <p className="pipeline-empty-body">
            O painel Pipeline dispara as fases do framework{" "}
            <code>agentic-harness</code> (spike → plan → task → pr). Instale o
            plugin no Claude Code e reinicie a sessão:
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
          <span className="pipeline-branch" title="Branch atual">
            {pipeline.branch}
          </span>
        )}
        <button
          type="button"
          className="pipeline-refresh"
          onClick={refresh}
          disabled={loading}
          title="Reler estado do worktree"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

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
                  ? "concluído"
                  : phase.status === "running"
                    ? "em execução…"
                    : ""}
              </span>
            </div>

            {activePhase === phase.key && (
              <PhaseExpandedSection
                phase={phase}
                onSend={() => dispatchPhase(phase.command)}
                disabled={isStreaming}
              />
            )}

            {phase.detail && <div className="pipeline-phase-detail">{phase.detail}</div>}

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
        Fases disparam o comando correspondente na conversa — o mesmo que
        digitar <code>/harness-cmd:…</code>. Estado lido do worktree (arquivos,
        commits, PR), não de tracking interno.
      </p>
    </div>
  );
}
