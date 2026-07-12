// ─── Task Group Creation ─────────────────────────────────────────────
//
// A "task group" is an agent session plus a companion terminal session
// sharing the same working directory (the agent's isolated worktree) and
// the same sidebar `group` label.  Group identity is the session `group`
// field — already persisted in the sessions table and already used by
// SessionList for sidebar grouping — so no new layout or DB state is
// needed for the group to survive a workspace restore.
//
// This module is deliberately outside SessionContext.tsx: it composes the
// context's public `createSession` API instead of growing the monolith.

import type { CreateSessionOpts, SessionData } from "../types/session";

export interface TaskGroupResult {
  agent: SessionData;
  /** Null when the companion terminal failed to create — the agent
   *  session is still usable and the caller falls back to a single pane. */
  terminal: SessionData | null;
}

/** Derive the sidebar group label for a task group.  Falls back through
 *  explicit group → session label → first selected branch name. */
export function resolveGroupLabel(opts: CreateSessionOpts): string | undefined {
  if (opts.group) return opts.group;
  if (opts.label) return opts.label;
  const firstSelection = opts.branchSelections
    ? Object.values(opts.branchSelections)[0]
    : undefined;
  return firstSelection?.branch;
}

/**
 * Create an agent session and its companion terminal in the same working
 * directory.  The terminal is best-effort: if it fails, the agent session
 * survives and `terminal` is null.  Returns null only when the agent
 * session itself could not be created (worktree failures already surface
 * through the `entry:worktree-errors` event inside `createSession`).
 */
export async function createTaskGroup(
  createSession: (opts?: CreateSessionOpts) => Promise<SessionData | null>,
  agentOpts: CreateSessionOpts,
): Promise<TaskGroupResult | null> {
  const group = resolveGroupLabel(agentOpts);

  const agent = await createSession({
    ...agentOpts,
    mode: "agent",
    group,
    companionTerminal: undefined,
  });
  if (!agent) return null;

  let terminal: SessionData | null = null;
  try {
    // The backend resolved the agent's effective cwd (worktree when one
    // was created) into `working_directory` — the terminal simply opens
    // there.  No projectIds/branchSelections: the terminal must not
    // create or claim worktrees of its own.
    terminal = await createSession({
      mode: "terminal",
      label: agentOpts.label ? `${agentOpts.label} · terminal` : "terminal",
      group,
      color: agentOpts.color,
      workingDirectory: agent.working_directory || agentOpts.workingDirectory,
    });
  } catch (err) {
    console.warn("[taskGroup] Companion terminal creation failed:", err);
    terminal = null;
  }

  return { agent, terminal };
}
