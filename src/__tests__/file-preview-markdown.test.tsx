// @vitest-environment jsdom
/**
 * FilePreviewPanel — markdown renders as a document (IntelliJ-style)
 * instead of raw source, with a Preview ⇄ Editar toggle.  Mermaid
 * fences route through MarkdownBody → CodeFence (covered by its own
 * component; here we assert the fence reaches the renderer).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const MD_CONTENT = "# Título Grande\n\nparágrafo com **negrito**\n\n```mermaid\ngraph TD; A-->B;\n```\n";

vi.mock("../api/git", () => ({
  readFileContent: vi.fn(() =>
    Promise.resolve({
      file_name: "README.md",
      content: MD_CONTENT,
      language: "markdown",
      is_binary: false,
      size: MD_CONTENT.length,
      mtime: 1,
    }),
  ),
  openFileInEditor: vi.fn(),
  sshReadFile: vi.fn(),
}));
vi.mock("../api/sessions", () => ({ writeToSession: vi.fn() }));
vi.mock("../api/settings", () => ({
  getSetting: vi.fn(() => Promise.resolve(null)),
  setSetting: vi.fn(() => Promise.resolve()),
}));
vi.mock("../state/SessionContext", () => ({
  useSession: () => ({ state: { sessions: {} } }),
}));
vi.mock("../hooks/useFileEditor", () => ({
  useFileEditor: () => ({
    content: "",
    setContent: vi.fn(),
    save: vi.fn(),
    isDirty: false,
    isSaving: false,
    saveError: null,
  }),
}));
// EditorPane pulls CodeMirror — stub it out.
vi.mock("../editor/EditorPane", () => ({
  EditorPane: () => <div data-testid="editor-pane" />,
}));
// Mermaid renders async via dynamic import — stub the diagram component's
// heavy dep boundary at CodeFence level is unnecessary; MarkdownBody will
// render the fence container synchronously.
vi.mock("../agent/blocks/CodeFence", () => ({
  CodeFence: ({ language }: { language: string | null }) => (
    <div data-testid={`fence-${language ?? "plain"}`} />
  ),
}));

import { FilePreviewPanel } from "../components/FilePreviewPanel";

function setup() {
  render(
    <FilePreviewPanel
      sessionId="s1"
      projectId="p1"
      filePath="/repo/README.md"
      onBack={() => {}}
    />,
  );
}

describe("FilePreviewPanel markdown preview", () => {
  afterEach(cleanup);

  it("renders .md as a document by default (not raw source)", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByTestId("file-preview-markdown")).toBeTruthy();
    });
    // Rendered heading, not literal "# Título"
    expect(screen.getByRole("heading", { name: "Título Grande" })).toBeTruthy();
    expect(screen.queryByTestId("editor-pane")).toBeNull();
  });

  it("routes mermaid fences to the diagram renderer", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByTestId("fence-mermaid")).toBeTruthy();
    });
  });

  it("Editar switches to the editor; Preview switches back", async () => {
    setup();
    await waitFor(() => screen.getByTestId("file-preview-markdown"));
    fireEvent.click(screen.getByRole("tab", { name: "Editar" }));
    expect(screen.getByTestId("editor-pane")).toBeTruthy();
    expect(screen.queryByTestId("file-preview-markdown")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("file-preview-markdown")).toBeTruthy();
  });
});
