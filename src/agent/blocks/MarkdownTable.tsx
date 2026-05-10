import { useState, type ReactNode } from "react";
import { ExpandedViewModal } from "./ExpandedViewModal";

interface MarkdownTableProps {
  children: ReactNode;
}

/**
 * GFM table renderer used by <MarkdownBody>.
 *
 * Wraps the table in a horizontal scroll container (so wide tables don't
 * blow out the chat column) and adds a small header bar with an "expand"
 * button.  The expanded view re-renders the same table inside a tall
 * scrollable container so the sticky header pins to the top while the user
 * scrolls long datasets.
 *
 * The table markup itself is reused in both views — react-markdown produces
 * the <thead>/<tbody> children once and we render the same React tree in
 * the inline and expanded surfaces.
 */
export function MarkdownTable({ children }: MarkdownTableProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <figure className="agent-md-table-figure">
        <header className="agent-md-table-header">
          <span className="agent-md-table-label">table</span>
          <button
            type="button"
            className="agent-md-table-expand"
            onClick={() => setExpanded(true)}
            aria-label="Expand table"
            title="Expand"
          >
            expand
          </button>
        </header>
        <div className="agent-md-table-wrap">
          <table className="agent-md-table">{children}</table>
        </div>
      </figure>
      {expanded && (
        <ExpandedViewModal title="table" onClose={() => setExpanded(false)}>
          <div className="agent-expand-table-wrap">
            <table className="agent-md-table agent-expand-table">{children}</table>
          </div>
        </ExpandedViewModal>
      )}
    </>
  );
}
