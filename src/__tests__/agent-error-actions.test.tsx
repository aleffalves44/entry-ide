// @vitest-environment jsdom
/**
 * Tests for R1, R3, R5, R6: agent-error-actions
 *
 * Covers:
 *   - AgentErrorActions renders all three buttons on both failure surfaces
 *   - Retry triggers the recovery handler
 *   - Switch to Terminal triggers the conversion request
 *   - Open AI setup opens Settings at the ai-agent tab
 *   - Disabled state when canSwitchMode is false (R5)
 *   - Both failure surfaces (agent-result-error banner + agent-exit-notice)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { renderToString } from "react-dom/server";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

// Mock SessionContext — AgentSessionView reads sendAgentEnvelope,
// state.sessions, respawnAgent, convertSessionMode.
const mockRespawnAgent = vi.fn(async () => true);
const mockConvertSessionMode = vi.fn(async () => true);

vi.mock("../state/SessionContext", () => ({
  useSession: () => ({
    sendAgentEnvelope: vi.fn(async () => {}),
    respawnAgent: mockRespawnAgent,
    convertSessionMode: mockConvertSessionMode,
    state: { sessions: {} },
  }),
}));

// Mock IDEShellContext — provides onOpenSettings.
const mockOnOpenSettings = vi.fn();
vi.mock("../state/IDEShellContext", () => ({
  useIDEShell: () => ({
    onOpenSettings: mockOnOpenSettings,
  }),
}));

import { AgentErrorActions } from "../agent/AgentSessionView";
import { AgentSessionView } from "../agent/AgentSessionView";
import {
  getOrCreateAgentSessionStore,
  _resetAgentSessionStoresForTest,
} from "../agent/agentSessionStore";
import type { AgentEvent } from "../agent/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Seed a store with a user message so we bypass the empty-state early return. */
function seedUserMessage(sessionId: string) {
  const store = getOrCreateAgentSessionStore(sessionId, async () => () => {});
  const userEvent: AgentEvent = {
    type: "user",
    message: { role: "user", content: [{ type: "text", text: "hello" }] },
    session_id: sessionId,
  };
  store.injectEvent(userEvent);
  return store;
}

afterEach(() => {
  cleanup();
  _resetAgentSessionStoresForTest();
  vi.clearAllMocks();
});

// ── AgentErrorActions unit tests ─────────────────────────────────────────────

describe("AgentErrorActions", () => {
  it("renders Retry, Switch to Terminal, and Open AI setup buttons", () => {
    const onRetry = vi.fn();
    const onSwitchMode = vi.fn();
    const onOpenSettings = vi.fn();

    const { getByRole } = render(
      <AgentErrorActions
        onRetry={onRetry}
        onSwitchMode={onSwitchMode}
        canSwitchMode={true}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /switch to terminal/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /open ai setup/i })).toBeInTheDocument();
  });

  it("calls onRetry when Retry is clicked", () => {
    const onRetry = vi.fn();
    const { getByRole } = render(
      <AgentErrorActions
        onRetry={onRetry}
        onSwitchMode={vi.fn()}
        canSwitchMode={true}
        onOpenSettings={vi.fn()}
      />,
    );
    fireEvent.click(getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("calls onSwitchMode when Switch to Terminal is clicked", () => {
    const onSwitchMode = vi.fn();
    const { getByRole } = render(
      <AgentErrorActions
        onRetry={vi.fn()}
        onSwitchMode={onSwitchMode}
        canSwitchMode={true}
        onOpenSettings={vi.fn()}
      />,
    );
    fireEvent.click(getByRole("button", { name: /switch to terminal/i }));
    expect(onSwitchMode).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenSettings when Open AI setup is clicked", () => {
    const onOpenSettings = vi.fn();
    const { getByRole } = render(
      <AgentErrorActions
        onRetry={vi.fn()}
        onSwitchMode={vi.fn()}
        canSwitchMode={true}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.click(getByRole("button", { name: /open ai setup/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("renders Open AI setup button even when onOpenSettings is a no-op (required prop)", () => {
    // onOpenSettings is now required — callers pass a no-op when IDEShellContext
    // is absent. The button must always render regardless of handler identity.
    const { getByRole } = render(
      <AgentErrorActions
        onRetry={vi.fn()}
        onSwitchMode={vi.fn()}
        canSwitchMode={true}
        onOpenSettings={() => { /* no-op — shell not mounted */ }}
      />,
    );
    expect(getByRole("button", { name: /open ai setup/i })).toBeInTheDocument();
  });

  it("renders Switch to Terminal disabled with tooltip when canSwitchMode is false (R5)", () => {
    // canSwitchMode derives from Boolean(onRequestSwitchToTerminal) at the
    // AgentSessionView call sites; here we test the component prop directly.
    const { getByRole } = render(
      <AgentErrorActions
        onRetry={vi.fn()}
        onSwitchMode={undefined}
        canSwitchMode={false}
        switchModeReason="Mode switch unavailable for this session"
        onOpenSettings={vi.fn()}
      />,
    );
    const btn = getByRole("button", { name: /switch to terminal/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Mode switch unavailable for this session");
  });

  it("is accessible: buttons have visible group role", () => {
    const { getByRole } = render(
      <AgentErrorActions
        onRetry={vi.fn()}
        onSwitchMode={vi.fn()}
        canSwitchMode={true}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(getByRole("group", { name: /recovery actions/i })).toBeInTheDocument();
  });
});

// ── Integration: exit-notice surface ─────────────────────────────────────────

describe("AgentSessionView — exit-notice failure surface", () => {
  const SESSION_ID = "test-exit-notice-actions";

  it("renders three action buttons on the exit-notice surface (AC1)", async () => {
    const store = seedUserMessage(SESSION_ID);

    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    // Inject an abnormal exit so shouldShowExitNotice returns true.
    act(() => {
      store.injectExit({ code: 1, signal: null });
    });

    view.rerender(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    expect(view.container.querySelector(".agent-exit-notice")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(view.getByRole("button", { name: /switch to terminal/i })).toBeInTheDocument();
    // Open AI setup renders because IDEShellContext mock returns onOpenSettings.
    expect(view.getByRole("button", { name: /open ai setup/i })).toBeInTheDocument();
  });

  it("Retry on exit-notice clears the exit state (AC1)", async () => {
    const store = seedUserMessage(SESSION_ID);

    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    act(() => {
      store.injectExit({ code: 1, signal: null });
    });
    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);

    const retryBtn = view.getByRole("button", { name: /retry/i });
    act(() => { fireEvent.click(retryBtn); });

    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);
    // After clear the exit notice should be gone.
    expect(view.container.querySelector(".agent-exit-notice")).toBeNull();
  });

  it("Switch to Terminal on exit-notice triggers conversion request (AC1)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const onRequestSwitchToTerminal = vi.fn();

    const view = render(
      <AgentSessionView
        sessionId={SESSION_ID}
        workspacePathCount={1}
        onRequestSwitchToTerminal={onRequestSwitchToTerminal}
      />,
    );

    act(() => { store.injectExit({ code: 1, signal: null }); });
    view.rerender(
      <AgentSessionView
        sessionId={SESSION_ID}
        workspacePathCount={1}
        onRequestSwitchToTerminal={onRequestSwitchToTerminal}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /switch to terminal/i }));
    expect(onRequestSwitchToTerminal).toHaveBeenCalledTimes(1);
  });

  it("Open AI setup on exit-notice calls ideShell.onOpenSettings with ai-agent tab (AC3)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    act(() => { store.injectExit({ code: 1, signal: null }); });
    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);

    fireEvent.click(view.getByRole("button", { name: /open ai setup/i }));
    expect(mockOnOpenSettings).toHaveBeenCalledWith("ai-agent");
  });
});

// ── Integration: result-error banner surface ──────────────────────────────────

describe("AgentSessionView — result-error banner surface", () => {
  const SESSION_ID = "test-result-error-actions";

  function injectResultError(store: ReturnType<typeof getOrCreateAgentSessionStore>) {
    const resultEvent: AgentEvent = {
      type: "result",
      subtype: "error",
      is_error: true,
      result: "prompt is too long",
      session_id: SESSION_ID,
      total_cost_usd: 0,
      duration_ms: 100,
      num_turns: 1,
    };
    store.injectEvent(resultEvent);
  }

  it("renders three action buttons on the result-error banner (AC1)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    act(() => { injectResultError(store); });
    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);

    expect(view.container.querySelector(".agent-result-error")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(view.getByRole("button", { name: /switch to terminal/i })).toBeInTheDocument();
    expect(view.getByRole("button", { name: /open ai setup/i })).toBeInTheDocument();
  });

  it("Retry on result-error banner triggers respawnAgent (AC1)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    act(() => { injectResultError(store); });
    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);

    fireEvent.click(view.getByRole("button", { name: /retry/i }));
    expect(mockRespawnAgent).toHaveBeenCalledWith(SESSION_ID);
  });

  it("Switch to Terminal on result-error banner triggers conversion request (AC1)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const onRequestSwitchToTerminal = vi.fn();

    const view = render(
      <AgentSessionView
        sessionId={SESSION_ID}
        workspacePathCount={1}
        onRequestSwitchToTerminal={onRequestSwitchToTerminal}
      />,
    );

    act(() => { injectResultError(store); });
    view.rerender(
      <AgentSessionView
        sessionId={SESSION_ID}
        workspacePathCount={1}
        onRequestSwitchToTerminal={onRequestSwitchToTerminal}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /switch to terminal/i }));
    expect(onRequestSwitchToTerminal).toHaveBeenCalledTimes(1);
  });

  it("Open AI setup on result-error banner calls ideShell.onOpenSettings with ai-agent tab (AC3)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    act(() => { injectResultError(store); });
    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);

    fireEvent.click(view.getByRole("button", { name: /open ai setup/i }));
    expect(mockOnOpenSettings).toHaveBeenCalledWith("ai-agent");
  });

  it("existing diagnostic text is preserved — result-error banner not text-only (AC2, AC4)", async () => {
    const store = seedUserMessage(SESSION_ID);
    const view = render(
      <AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />,
    );

    act(() => { injectResultError(store); });
    view.rerender(<AgentSessionView sessionId={SESSION_ID} workspacePathCount={1} />);

    const banner = view.container.querySelector(".agent-result-error");
    expect(banner?.textContent).toContain("Claude couldn't continue");
    expect(banner?.textContent).toContain("prompt is too long");
    // Actions present — not text-only.
    expect(banner?.querySelector(".agent-error-actions")).toBeInTheDocument();
  });
});
