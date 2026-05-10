/**
 * Pure helpers for the TODO panel.  Reads the latest TodoWrite tool_use
 * out of a stream of content blocks and returns the TODOs as a typed
 * array.  Tested independently from the panel component (M2 §2 / §7.6).
 */

export type TodoStatus = "pending" | "in_progress" | "completed" | "unknown";

export interface TodoItem {
  content: string;
  status: TodoStatus;
}

const KNOWN_STATUSES = new Set<TodoStatus>(["pending", "in_progress", "completed"]);

interface ToolUseLike {
  type?: string;
  name?: string;
  input?: { todos?: Array<{ content?: unknown; status?: unknown }> };
}

/** Walk the block list latest-first, return the most recent TodoWrite's
 *  todos array (with safe-typed status).  An empty `todos: []` is honored
 *  as "all done — clear the panel". */
export function extractTodos(blocks: readonly ToolUseLike[]): TodoItem[] {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.type !== "tool_use" || b.name !== "TodoWrite") continue;
    const todos = b.input?.todos;
    if (!Array.isArray(todos)) return [];
    return todos.map((t) => {
      const content = typeof t.content === "string" ? t.content : "";
      const rawStatus = typeof t.status === "string" ? (t.status as TodoStatus) : "unknown";
      const status: TodoStatus = KNOWN_STATUSES.has(rawStatus) ? rawStatus : "unknown";
      return { content, status };
    });
  }
  return [];
}

/** Variant that walks a messages list newest-first WITHOUT first
 *  building a flattened block array.  The full `extractTodos(blocks)`
 *  path required the caller to do `messages.flatMap(...)` which
 *  allocates an O(total-blocks) array on every render — heavy GC
 *  pressure in long sessions.  This variant short-circuits on the
 *  first TodoWrite encountered, walking newest message first. */
export function extractTodosFromMessages(
  messages: readonly { role: string; blocks?: readonly ToolUseLike[] }[],
): TodoItem[] {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const m = messages[mi];
    if (m.role !== "assistant" || !m.blocks || m.blocks.length === 0) continue;
    for (let bi = m.blocks.length - 1; bi >= 0; bi--) {
      const b = m.blocks[bi];
      if (b.type !== "tool_use" || b.name !== "TodoWrite") continue;
      const todos = b.input?.todos;
      if (!Array.isArray(todos)) return [];
      return todos.map((t) => {
        const content = typeof t.content === "string" ? t.content : "";
        const rawStatus = typeof t.status === "string" ? (t.status as TodoStatus) : "unknown";
        const status: TodoStatus = KNOWN_STATUSES.has(rawStatus) ? rawStatus : "unknown";
        return { content, status };
      });
    }
  }
  return [];
}

export function todoCounts(todos: readonly TodoItem[]): { done: number; total: number } {
  return {
    done: todos.filter((t) => t.status === "completed").length,
    total: todos.length,
  };
}
