/**
 * Checks if a path is inside the Entry worktrees directory
 * (entry-worktrees/), indicating it's a linked worktree rather
 * than the main checkout.
 */
export function isEntryWorktreePath(path: string): boolean {
  return path.includes('entry-worktrees/');
}
