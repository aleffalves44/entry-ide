// @vitest-environment jsdom
/**
 * UsageWindow (M4) — standalone Consumo Geral window.
 *
 * Reads sessions + framework_usage via Tauri commands only; clicking a
 * session row emits entry://focus-session and focuses the main window.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const emitMock = vi.fn(() => Promise.resolve());
const setFocusMock = vi.fn(() => Promise.resolve());

vi.mock("@tauri-apps/api/event", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: {
    getByLabel: vi.fn(() => Promise.resolve({ setFocus: setFocusMock })),
  },
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    setAlwaysOnTop: vi.fn(() => Promise.resolve()),
    onCloseRequested: vi.fn(() => Promise.resolve(() => {})),
    setSize: vi.fn(() => Promise.resolve()),
    setPosition: vi.fn(() => Promise.resolve()),
    onResized: vi.fn(),
    onMoved: vi.fn(),
    innerSize: vi.fn(() => Promise.resolve({ width: 760, height: 720 })),
    outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
    scaleFactor: vi.fn(() => Promise.resolve(1)),
  })),
}));
vi.mock("../api/settings", () => ({
  getSettings: vi.fn(() => Promise.resolve({})),
  getSetting: vi.fn(() => Promise.resolve(null)),
  setSetting: vi.fn(() => Promise.resolve()),
}));

const sessions = [
  { id: "sess-agent-1", label: "checkout-fix", group: "TSDA-102", phase: "working", mode: "agent" },
  { id: "sess-dead", label: "old", group: null, phase: "destroyed", mode: "agent" },
];
const usageRows = [
  {
    session_id: "sess-agent-1",
    turn_uuid: "t1",
    kind: "turn",
    provider: "claude",
    model: "claude-fable-5",
    command: "harness-cmd:task",
    agent: "main",
    phase: "task",
    input_tokens: 2000,
    output_tokens: 1000,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    duration_ms: 5000,
    cost_usd: 1.5,
  },
];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "get_sessions") return Promise.resolve(sessions);
    if (cmd === "get_framework_usage") return Promise.resolve(usageRows);
    return Promise.resolve([]);
  }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));

import { UsageWindow } from "../windows/UsageWindow";

describe("UsageWindow", () => {
  afterEach(() => {
    cleanup();
    emitMock.mockClear();
    setFocusMock.mockClear();
  });

  it("lists live sessions with cost and hides destroyed ones", async () => {
    render(<UsageWindow />);
    await waitFor(() => {
      expect(screen.getByText("checkout-fix")).toBeTruthy();
    });
    expect(screen.queryByText("old")).toBeNull();
    // Session cost from its turn rows (header total + session row)
    expect(screen.getAllByText("$1.50").length).toBeGreaterThanOrEqual(2);
  });

  it("clicking a session emits focus-session and focuses the main window", async () => {
    render(<UsageWindow />);
    await waitFor(() => {
      expect(screen.getByText("checkout-fix")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("checkout-fix"));
    await waitFor(() => {
      expect(emitMock).toHaveBeenCalledWith("entry://focus-session", {
        sessionId: "sess-agent-1",
      });
      expect(setFocusMock).toHaveBeenCalled();
    });
  });
});
