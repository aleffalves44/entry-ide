/**
 * OpenProjectDialog — pick an EXISTING project to open for browsing.
 *
 * Complements the quick creator: "open project" means "get me into this
 * codebase with the file tree visible", not "start a new isolated task".
 * The host opens an agent session on the project's current branch (no
 * worktree) and lands the Workbench on the Files tab.
 */
import "../styles/components/OpenProjectDialog.css";
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getProjectsOrdered, createProject } from "../api/projects";
import type { ProjectOrdered } from "../types/project";

interface OpenProjectDialogProps {
  onClose: () => void;
  onPick: (project: ProjectOrdered) => void;
}

export function OpenProjectDialog({ onClose, onPick }: OpenProjectDialogProps) {
  const [projects, setProjects] = useState<ProjectOrdered[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProjectsOrdered()
      .then((list) => {
        if (!cancelled) setProjects(list.filter((p) => p.path_exists));
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addFolder = async () => {
    const path = await open({ directory: true, multiple: false });
    if (typeof path !== "string" || !path) return;
    try {
      const project = await createProject(path, null);
      onPick({
        ...project,
        session_count: 0,
        last_opened_at: null,
        path_exists: true,
      });
    } catch (err) {
      console.error("[OpenProjectDialog] Failed to add folder:", err);
    }
  };

  return (
    <div
      className="command-palette-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="open-project"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        data-testid="open-project-dialog"
      >
        <div className="open-project-header">
          <span className="open-project-title">Abrir projeto</span>
          <button className="open-project-close" onClick={onClose} title="Fechar (Esc)">
            ×
          </button>
        </div>

        {projects === null ? (
          <div className="open-project-empty">Carregando projetos…</div>
        ) : (
          <>
            <ul className="open-project-list">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    className="open-project-item"
                    onClick={() => onPick(p)}
                    autoFocus={p === projects[0]}
                  >
                    <span className="open-project-name">{p.name}</span>
                    <span className="open-project-path" title={p.path}>
                      {p.path.replace(/^\/Users\/[^/]+/, "~")}
                    </span>
                  </button>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="open-project-empty">Nenhum projeto cadastrado ainda.</li>
              )}
            </ul>
            <div className="open-project-footer">
              <button className="open-project-add" onClick={() => void addFolder()}>
                + Adicionar pasta…
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
