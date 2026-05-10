/**
 * TodoPanel — sticky checklist pinned to the bottom of the conversation
 * column.  Visual: §8.6.
 *
 * Driven by the latest TodoWrite tool_use.  Hides itself when:
 *   - the todos list is empty, OR
 *   - every item in the list is `completed` (the work is done — pinning
 *     a fully-checked list at the bottom forever is just clutter; the
 *     conversation history above already records what was finished).
 *
 * Visibility is list-driven, not toggle-driven, so the panel reappears
 * automatically the moment Claude calls TodoWrite again.
 */
import "../styles/components/TodoPanel.css";
import { useState } from "react";
import { todoCounts, type TodoItem, type TodoStatus } from "../utils/todoStore";

const STATUS_GLYPH: Record<TodoStatus, string> = {
  pending: "☐",
  in_progress: "▸",
  completed: "✓",
  unknown: "?",
};

interface Props {
  todos: TodoItem[];
}

export function TodoPanel({ todos }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  if (todos.length === 0) return null;

  const { done, total } = todoCounts(todos);
  // Auto-dismiss: a fully-completed list is past the user's "what's
  // happening now" view.  Hide rather than keep it pinned to the bottom.
  if (total > 0 && done === total) return null;

  const inProgress = todos.find((t) => t.status === "in_progress");

  return (
    <aside className="todo-panel" data-testid="todo-panel">
      <button
        type="button"
        className="todo-panel-header"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span className="todo-panel-title">TODOS</span>
        <span className="todo-panel-sep">·</span>
        <span className="todo-panel-count">{done}/{total}</span>
        {collapsed && inProgress && (
          <>
            <span className="todo-panel-sep">·</span>
            <span className="todo-panel-running">running: {inProgress.content || "(empty)"}</span>
          </>
        )}
        <span className="todo-panel-disclosure" aria-hidden="true">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <ol className="todo-rows">
          {todos.map((t, i) => (
            <li
              key={i}
              className="todo-row"
              data-status={t.status}
            >
              <span className="todo-glyph" aria-hidden="true">
                {STATUS_GLYPH[t.status]}
              </span>
              <span className="todo-content">
                {t.content === "" ? <span className="todo-empty">(empty)</span> : t.content}
              </span>
              {t.status === "in_progress" && (
                <span className="todo-active-marker" aria-hidden="true">←</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
