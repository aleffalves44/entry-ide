import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ExpandedViewModalProps {
  /** Short label shown in the modal header (e.g. "mermaid diagram", "table"). */
  title: string;
  /** Invoked on Esc, backdrop click, or close-button click. */
  onClose: () => void;
  /** The expanded content. */
  children: ReactNode;
  /** Optional extra controls (rendered between the title and the close button). */
  actions?: ReactNode;
}

/**
 * Generic full-screen overlay used to expand mermaid diagrams and tables for
 * easier inspection.  Rendered through a React portal to `document.body` so
 * the modal escapes the chat scroll container and overlays the entire app.
 *
 * Closes on:
 *   - Escape keypress
 *   - Click on the dimmed backdrop (clicks inside the panel are ignored)
 *   - The "×" close button in the header
 *
 * Focus is moved to the close button on mount and a simple focus trap keeps
 * Tab cycling inside the panel while the modal is open.  Body scroll is
 * locked so the chat surface doesn't drift behind the overlay.
 *
 * The modal is purely presentational — owners control open/close state and
 * decide what to render inside.
 */
export function ExpandedViewModal({ title, onClose, children, actions }: ExpandedViewModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Esc to close, focus trap on Tab, and remember the previously focused
  // element so we can restore focus when the modal closes.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="agent-expand-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // Close only when the click originates on the backdrop itself —
        // ignore mouse-downs that started inside the panel (e.g. selecting
        // table text and dragging onto the dimmed area).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="agent-expand-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="agent-expand-header">
          <span className="agent-expand-title">{title}</span>
          <span className="agent-expand-actions">
            {actions}
            <button
              ref={closeButtonRef}
              type="button"
              className="agent-expand-close"
              onClick={onClose}
              aria-label="Close expanded view"
              title="Close (Esc)"
            >
              ×
            </button>
          </span>
        </header>
        <div className="agent-expand-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
