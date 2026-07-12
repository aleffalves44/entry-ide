/**
 * QuickSessionCreator — one-screen session start (the friction killer).
 *
 * The default "new session" surface: most-recent project pre-selected,
 * the branch selector embedded inline (its mount auto-picks the current
 * branch), and one confirm.  Happy path: Cmd+N → Enter.
 *
 * Everything else — terminal/SSH modes, multi-project, channels,
 * permissions — lives in the full SessionCreator wizard, reachable via
 * "Avançado…".  This component intentionally creates AGENT sessions
 * only.
 */
import "../styles/components/QuickSessionCreator.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getProjectsOrdered, createProject } from "../api/projects";
import { SessionBranchSelector } from "./SessionBranchSelector";
import type { CreateSessionOpts } from "../types/session";
import type { ProjectOrdered } from "../types/project";

interface BranchSelection {
  branch: string;
  createNew: boolean;
  fromRemote?: string;
}

interface QuickSessionCreatorProps {
  onClose: () => void;
  onCreate: (opts: CreateSessionOpts) => Promise<void>;
  /** Open the full SessionCreator wizard (terminal/SSH/multi-project…). */
  onAdvanced: () => void;
}

export function QuickSessionCreator({ onClose, onCreate, onAdvanced }: QuickSessionCreatorProps) {
  const [projects, setProjects] = useState<ProjectOrdered[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branchSel, setBranchSel] = useState<BranchSelection | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getProjectsOrdered()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        // Most recent project whose folder still exists.
        const first = list.find((p) => p.path_exists) ?? list[0] ?? null;
        setSelectedId(first?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => projects?.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  /** Native folder dialog → register the project → select it.  Same
   *  backend flow as the wizard's Browse (create_project). */
  const addFolder = useCallback(async () => {
    const path = await open({ directory: true, multiple: false });
    if (typeof path !== "string" || !path) return;
    try {
      const project = await createProject(path, null);
      const ordered: ProjectOrdered = {
        ...project,
        session_count: 0,
        last_opened_at: null,
        path_exists: true,
      };
      setProjects((prev) => [ordered, ...(prev ?? []).filter((p) => p.id !== project.id)]);
      setSelectedId(project.id);
      setBranchSel(null);
    } catch (err) {
      console.error("[QuickSessionCreator] Failed to add folder:", err);
    }
  }, []);

  const create = useCallback(async () => {
    if (!selected || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      await onCreate({
        mode: "agent",
        aiProvider: "claude",
        projectIds: [selected.id],
        workingDirectory: selected.path,
        branchSelections: branchSel ? { [selected.id]: branchSel } : undefined,
        // Sidebar organization for free: group = project name.
        group: selected.name,
      });
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [selected, branchSel, onCreate]);

  // Esc closes; Cmd/Ctrl+Enter creates from anywhere in the modal
  // (plain Enter is owned by the embedded branch selector's list).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void create();
      }
    },
    [onClose, create],
  );

  return (
    <div
      className="command-palette-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="quick-creator"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="quick-session-creator"
      >
        <div className="quick-creator-header">
          <span className="quick-creator-title">Nova sessão</span>
          <button className="quick-creator-close" onClick={onClose} title="Fechar (Esc)">
            ×
          </button>
        </div>

        {projects === null ? (
          <div className="quick-creator-empty">Carregando projetos…</div>
        ) : projects.length === 0 ? (
          <div className="quick-creator-empty">
            Nenhum projeto cadastrado ainda.
            <button className="quick-creator-btn" onClick={() => void addFolder()}>
              Adicionar pasta…
            </button>
          </div>
        ) : (
          <>
            <label className="quick-creator-field">
              <span className="quick-creator-label">Projeto</span>
              <select
                className="quick-creator-select"
                value={selectedId ?? ""}
                autoFocus
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setBranchSel(null);
                }}
                onKeyDown={(e) => {
                  // Plain Enter on the project select = confirm creation
                  // (the common flow: Cmd+N, glance, Enter).
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    void create();
                  }
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.path_exists}>
                    {p.name}
                    {!p.path_exists ? " (pasta ausente)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="quick-creator-btn quick-creator-add"
                onClick={() => void addFolder()}
                title="Adicionar pasta como projeto"
                data-testid="quick-add-folder"
              >
                +
              </button>
            </label>

            {selected && (
              <div className="quick-creator-branch">
                {/* key remounts the selector per project — its mount
                    auto-propagates the current branch (zero clicks). */}
                <SessionBranchSelector
                  key={selected.id}
                  projectId={selected.id}
                  existingBranchName={branchSel?.branch}
                  onBranchSelected={(branch, createNew, fromRemote) =>
                    setBranchSel({ branch, createNew, fromRemote })
                  }
                  onSkip={() => setBranchSel(null)}
                />
              </div>
            )}

            <div className="quick-creator-footer">
              <span className="quick-creator-hint">
                {branchSel
                  ? `Branch: ${branchSel.branch}${branchSel.createNew ? " (nova)" : ""}`
                  : "Sem worktree — branch atual do repo"}
              </span>
              <button className="quick-creator-btn" onClick={onAdvanced}>
                Avançado…
              </button>
              <button
                className="quick-creator-btn quick-creator-create"
                onClick={() => void create()}
                disabled={!selected || creating}
                data-testid="quick-create-btn"
              >
                {creating ? "Criando…" : "Criar sessão ⌘↵"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
