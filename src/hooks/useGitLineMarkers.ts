import { useEffect, useState } from "react";
import { gitDiff } from "../api/git";
import type { GitGutterMarkers } from "../editor/gitGutter";

/**
 * Derives per-line git gutter markers from a unified diff text.
 *
 * Within each hunk, a run of deletions followed by additions is treated
 * as modified lines (pairwise); surplus additions are "added" and a
 * deletion run with no matching addition marks the boundary line as
 * "deleted".
 */
export function deriveMarkersFromDiff(diffText: string): GitGutterMarkers {
  const added = new Set<number>();
  const modified = new Set<number>();
  const deleted = new Set<number>();

  let newLine = 0;
  let pendingDels = 0;
  let inHunk = false;

  const flushDeletionBoundary = () => {
    if (pendingDels > 0) {
      deleted.add(Math.max(1, newLine - 1));
      pendingDels = 0;
    }
  };

  for (const raw of diffText.split("\n")) {
    if (raw.startsWith("@@")) {
      flushDeletionBoundary();
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
      newLine = m ? parseInt(m[1], 10) : 1;
      inHunk = true;
    } else if (!inHunk) {
      continue; // file headers before the first hunk
    } else if (raw.startsWith("+")) {
      if (pendingDels > 0) {
        modified.add(newLine);
        pendingDels--;
      } else {
        added.add(newLine);
      }
      newLine++;
    } else if (raw.startsWith("-")) {
      pendingDels++;
    } else if (raw.startsWith(" ")) {
      flushDeletionBoundary();
      newLine++;
    }
    // "\ No newline at end of file" and blank trailing lines are ignored.
  }
  flushDeletionBoundary();

  return { added, modified, deleted };
}

/**
 * Fetches the unstaged diff for `filePath` and derives gutter markers.
 * Returns `null` (gutter hidden) while loading, on error, for binary or
 * truncated diffs, and for non-repo surfaces (SSH, plugin virtual
 * projects).  `refreshToken` re-triggers the fetch — pass the editor's
 * last-saved timestamp so markers update after a save.
 */
export function useGitLineMarkers(
  sessionId: string,
  projectId: string,
  filePath: string,
  refreshToken?: unknown,
): GitGutterMarkers | null {
  const [markers, setMarkers] = useState<GitGutterMarkers | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarkers(null);
    if (!sessionId || !projectId || projectId.startsWith("__")) return;

    gitDiff(sessionId, projectId, filePath, false)
      .then((d) => {
        if (cancelled) return;
        if (d.is_binary || d.truncated || !d.diff_text) {
          setMarkers(null);
          return;
        }
        setMarkers(deriveMarkersFromDiff(d.diff_text));
      })
      .catch(() => {
        // File outside a repo, unchanged, or IPC failure — no gutter.
        if (!cancelled) setMarkers(null);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, projectId, filePath, refreshToken]);

  return markers;
}
