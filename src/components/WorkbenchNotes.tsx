/**
 * Per-session notes drawer for the right-rail Workbench (1.1.14).
 *
 * Free-form scratchpad keyed by session id.  Saved every-keystroke
 * to React state via the SessionContext reducer, and persisted as
 * part of saved_workspace.json on the dirty-flag flush cycle.
 *
 * Visual: serif body with ruled-line background (mockup §01).
 * Empty state: italic prompt + caret hint when nothing has been
 * typed for the active session yet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../state/SessionContext";
import { clampNoteContent, NOTES_MAX_LEN } from "../utils/workbenchLayout";
import type { SessionData } from "../types/session";

interface WorkbenchNotesProps {
  session: SessionData;
}

/** Time we wait after the user's last keystroke before flipping the
 *  "saved" indicator.  Reducer dispatches happen on every keystroke
 *  (controlled textarea), so this is purely a visual signal that the
 *  flush hit React state.  Workspace JSON write is on its own cycle. */
const SAVED_INDICATOR_DELAY_MS = 600;

export function WorkbenchNotes({ session }: WorkbenchNotesProps) {
  const { state, dispatch } = useSession();
  const note = state.notes[session.id] ?? "";

  // "Saved" flag for the header indicator.  Flips to false as soon as
  // the user types, then back to true after SAVED_INDICATOR_DELAY_MS
  // of quiet.  Tracked separately from the controlled value so it's
  // a smooth "Saved · 11:43" → "Editing…" → "Saved · 11:44" cadence.
  const [savedAt, setSavedAt] = useState<number | null>(note.length > 0 ? Date.now() : null);
  const [editing, setEditing] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Switching sessions: reset the saved indicator from the new
  // session's content rather than the previous session's last
  // keystroke.  Without this, opening a session whose notes were
  // saved an hour ago shows "Editing…" for the first 600ms.
  useEffect(() => {
    setEditing(false);
    setSavedAt(note.length > 0 ? Date.now() : null);
    // Cancel any in-flight debounce from the previous session.
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Note: intentionally NOT keying off `note` here — that would
    // reset on every keystroke.  Only session-id changes matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = clampNoteContent(e.target.value);
      dispatch({
        type: "SET_SESSION_NOTE",
        sessionId: session.id,
        content: value,
      });
      setEditing(true);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        setEditing(false);
        setSavedAt(Date.now());
        debounceRef.current = null;
      }, SAVED_INDICATOR_DELAY_MS);
    },
    [dispatch, session.id],
  );

  // Cleanup the debounce timer on unmount so a slow flush doesn't
  // call setState on an unmounted component (React strict-mode
  // double-mount in tests would otherwise warn).
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  const savedLabel = useMemo(() => {
    if (editing) return "Editing…";
    if (savedAt === null) return "Empty";
    return `Saved · ${formatHHMM(savedAt)}`;
  }, [editing, savedAt]);

  return (
    <section
      className="workbench-notes"
      data-testid="workbench-notes"
      aria-label="Session notes"
    >
      <header className="workbench-notes-head">
        <h4>Notes</h4>
        <span className="stamp">SESSION-LOCAL</span>
        <span
          className="saved"
          data-state={editing ? "dirty" : "saved"}
          aria-live="polite"
        >
          {savedLabel}
        </span>
      </header>
      <textarea
        className="workbench-notes-textarea"
        data-testid="workbench-notes-textarea"
        value={note}
        onChange={onChange}
        placeholder="A scratchpad for this session — plans, todos, snippets. Saved per session, persists across restarts."
        spellCheck={false}
        aria-label="Session notes"
        maxLength={NOTES_MAX_LEN}
      />
      <footer className="workbench-notes-foot">
        <span>
          <span className="key">⌥</span>
          <span className="key">⌘</span>
          <span className="key">B</span> toggle workbench
        </span>
      </footer>
    </section>
  );
}

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
