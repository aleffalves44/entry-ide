// @vitest-environment jsdom
/**
 * Regression: the permission-mode chip in the agent composer must be
 * DISABLED while an agent turn is streaming.
 *
 * Flipping `--permission-mode` mid-turn sends a `setPermissionMode`
 * control op into the bridge while the SDK is mid-query / mid-canUseTool,
 * which races the active turn and freezes execution.  The fix disables
 * the chip while `streamingMessageId !== null || runningToolUseIds.size
 * > 0` — the same "turn in flight" edge the pipeline/workflow runners
 * use — so the mode only flips during the safe windows (idle + the
 * approval stops between pipeline phases).
 *
 * This test feeds an `assistant` event with `stop_reason: null` (the
 * real signal that sets `streamingMessageId`) into the session's agent
 * store and asserts the rendered permission chip is `disabled`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  getOrCreateAgentSessionStore,
  _resetAgentSessionStoresForTest,
} from "../agent/agentSessionStore";
import type { AgentEvent } from "../agent/types";

const SESSION_ID = "perm-chip-streaming-test";

const fakeState = {
  activeSessionId: SESSION_ID,
  sessions: {
    [SESSION_ID]: { id: SESSION_ID, mode: "agent" },
  },
  composers: {
    [SESSION_ID]: { draft: "", height: 120, expanded: true },
  },
};

vi.mock("../state/SessionContext", () => ({
  useSession: () => ({
    state: fakeState,
    dispatch: vi.fn(),
    switchAgentModel: vi.fn(),
    switchAgentPermissionMode: vi.fn(async () => true),
    switchAgentEffort: vi.fn(),
    submitAgentMessage: vi.fn(async () => {}),
  }),
  useComposer: () => fakeState.composers[SESSION_ID],
}));

// init with a model so `liveModel` is truthy and the permission chip
// actually renders (it's gated on `liveModel || pendingModel`).
vi.mock("../agent/useAgentInit", () => ({
  useAgentInit: () => ({
    model: "claude-sonnet-4-5",
    permissionMode: "default",
    slash_commands: [],
  }),
}));
vi.mock("../agent/useAgentPrewarm", () => ({
  useAgentPrewarm: () => ({ slashCommands: [], catalog: [] }),
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("../api/agent", () => ({
  readImageForAttachment: vi.fn(),
}));

import { SessionComposer } from "../components/SessionComposer";

function permChipButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(
    "button.session-composer-perm-chip-btn",
  );
  if (!el) throw new Error("permission-mode chip button not rendered");
  return el;
}

beforeEach(() => {
  _resetAgentSessionStoresForTest();
});

afterEach(() => {
  cleanup();
  _resetAgentSessionStoresForTest();
});

describe("permission-mode chip — disabled while a turn is streaming", () => {
  it("chip is ENABLED when no turn is in flight", async () => {
    // Create the store (no events → not streaming).
    getOrCreateAgentSessionStore(SESSION_ID, async () => () => {});

    const { container } = render(<SessionComposer />);
    await waitFor(() => expect(permChipButton(container)).toBeInTheDocument());
    expect(permChipButton(container).disabled).toBe(false);
  });

  it("chip is DISABLED once an assistant turn starts streaming", async () => {
    const store = getOrCreateAgentSessionStore(SESSION_ID, async () => () => {});

    const { container } = render(<SessionComposer />);
    await waitFor(() => expect(permChipButton(container)).toBeInTheDocument());
    expect(permChipButton(container).disabled).toBe(false);

    // Feed a non-closing assistant event — stop_reason: null sets
    // `streamingMessageId`, the real "turn in flight" signal.
    const streamingAssistant: AgentEvent = {
      type: "assistant",
      message: {
        id: "msg-1",
        role: "assistant",
        model: "claude-sonnet-4-5",
        content: [{ type: "text", text: "" } as never],
        stop_reason: null,
      },
      session_id: SESSION_ID,
      uuid: "evt-1",
    } as unknown as AgentEvent;
    store.injectEvent(streamingAssistant);

    await waitFor(() => {
      expect(permChipButton(container).disabled).toBe(true);
    });
    // Tooltip explains WHY it's disabled.
    expect(permChipButton(container).title).toMatch(/wait for the current turn/i);
  });

  it("chip re-ENABLES when the streaming turn closes (stop_reason set)", async () => {
    const store = getOrCreateAgentSessionStore(SESSION_ID, async () => () => {});

    const { container } = render(<SessionComposer />);
    await waitFor(() => expect(permChipButton(container)).toBeInTheDocument());

    // Start streaming.
    store.injectEvent({
      type: "assistant",
      message: {
        id: "msg-2",
        role: "assistant",
        model: "claude-sonnet-4-5",
        content: [{ type: "text", text: "" } as never],
        stop_reason: null,
      },
      session_id: SESSION_ID,
      uuid: "evt-2",
    } as unknown as AgentEvent);
    await waitFor(() => expect(permChipButton(container).disabled).toBe(true));

    // Close the turn — stop_reason clears streamingMessageId.
    store.injectEvent({
      type: "assistant",
      message: {
        id: "msg-2",
        role: "assistant",
        model: "claude-sonnet-4-5",
        content: [{ type: "text", text: "done" } as never],
        stop_reason: "end_turn",
      },
      session_id: SESSION_ID,
      uuid: "evt-3",
    } as unknown as AgentEvent);

    await waitFor(() => {
      expect(permChipButton(container).disabled).toBe(false);
    });
  });
});