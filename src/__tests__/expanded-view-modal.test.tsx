// @vitest-environment jsdom
/**
 * Tests for the shared <ExpandedViewModal> and the table expand affordance.
 *
 * Mermaid is exercised at the integration level — its render path is async
 * and depends on the mermaid module's lazy import; here we focus on the
 * synchronous behaviour: the modal's open/close lifecycle, focus
 * management, Esc handling, and the table component's expand flow.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ExpandedViewModal } from "../agent/blocks/ExpandedViewModal";
import { MarkdownTable } from "../agent/blocks/MarkdownTable";

afterEach(() => cleanup());

describe("<ExpandedViewModal>", () => {
  it("renders the title and content via a portal", () => {
    const onClose = vi.fn();
    render(
      <ExpandedViewModal title="diagram" onClose={onClose}>
        <div>panel content</div>
      </ExpandedViewModal>,
    );
    const dialog = screen.getByRole("dialog", { name: "diagram" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("panel content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ExpandedViewModal title="x" onClose={onClose}>
        <div />
      </ExpandedViewModal>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <ExpandedViewModal title="x" onClose={onClose}>
        <div />
      </ExpandedViewModal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <ExpandedViewModal title="x" onClose={onClose}>
        <div data-testid="inner" />
      </ExpandedViewModal>,
    );
    const backdrop = document.querySelector(".agent-expand-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close when the click originates inside the panel", () => {
    const onClose = vi.fn();
    render(
      <ExpandedViewModal title="x" onClose={onClose}>
        <div data-testid="inner">stuff</div>
      </ExpandedViewModal>,
    );
    fireEvent.mouseDown(screen.getByTestId("inner"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders custom actions in the header", () => {
    render(
      <ExpandedViewModal
        title="x"
        onClose={() => {}}
        actions={<button type="button">extra</button>}
      >
        <div />
      </ExpandedViewModal>,
    );
    expect(screen.getByRole("button", { name: "extra" })).toBeInTheDocument();
  });

  it("locks body scroll while open and restores it on unmount", () => {
    const previous = document.body.style.overflow;
    const { unmount } = render(
      <ExpandedViewModal title="x" onClose={() => {}}>
        <div />
      </ExpandedViewModal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe(previous);
  });
});

describe("<MarkdownTable>", () => {
  it("shows an expand button and opens the modal on click", () => {
    render(
      <MarkdownTable>
        <thead>
          <tr><th>col</th></tr>
        </thead>
        <tbody>
          <tr><td>val</td></tr>
        </tbody>
      </MarkdownTable>,
    );
    // Initially: just the inline figure, no dialog.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand/i }));

    const dialog = screen.getByRole("dialog", { name: "table" });
    expect(dialog).toBeInTheDocument();
    // The same row data should be re-rendered inside the modal.
    expect(within(dialog).getByText("val")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
