/**
 * Regression test: OS notification on pending agent decision when window hidden.
 *
 * Bug: when a `_entry_perm_request` arrives in AgentSessionStore while
 * `document.hidden` is true the app emits no OS notification, so the user
 * has no signal that Claude is waiting for input.
 *
 * Fix: AgentSessionStore accepts an `onPendingDecision` callback and an
 * optional `isWindowHidden` injector (defaults to `() => document.hidden`
 * in production).  The callback is invoked exactly once per unique request id
 * when the window is reported as hidden.  Tests inject a controllable stub.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AgentSessionStore,
  _resetAgentSessionStoresForTest,
} from "../agent/agentSessionStore";
import type { AgentEvent } from "../agent/types";

// ── Stub bus ────────────────────────────────────────────────────────────────

type StubListenerHandle = {
  attached: boolean;
  fire: (payload: unknown) => void;
};
interface StubBus {
  channels: Map<string, Set<StubListenerHandle>>;
  listen: <T>(name: string, handler: (msg: { payload: T }) => void) => Promise<() => void>;
}
function makeStubBus(): StubBus {
  const channels = new Map<string, Set<StubListenerHandle>>();
  return {
    channels,
    listen: <T,>(name: string, handler: (msg: { payload: T }) => void) => {
      let attached = true;
      const handle: StubListenerHandle = {
        get attached() { return attached; },
        set attached(v: boolean) { attached = v; },
        fire: (p: unknown) => handler({ payload: p as T }),
      };
      const set = channels.get(name) ?? new Set<StubListenerHandle>();
      set.add(handle);
      channels.set(name, set);
      return Promise.resolve(() => {
        handle.attached = false;
        set.delete(handle);
      });
    },
  };
}

// ── Event factories ─────────────────────────────────────────────────────────

function permRequestEvent(id: string, toolName = "Bash"): AgentEvent {
  return {
    type: "_entry_perm_request",
    id,
    toolName,
    input: { command: "echo hi" },
  } as unknown as AgentEvent;
}

function initEvent(sessionId: string): AgentEvent {
  return {
    type: "system",
    subtype: "init",
    session_id: sessionId,
    cwd: "/tmp",
    tools: [],
    mcp_servers: [],
    model: "claude-sonnet-4-6",
    permissionMode: "default",
    apiKeySource: "anthropic",
    output_style: "default",
    slash_commands: [],
  } as unknown as AgentEvent;
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetAgentSessionStoresForTest();
});

describe("RF-FIX-01: notify OS when pending perm-request arrives and window is hidden", () => {
  it("onPendingDecision callback is called when isWindowHidden returns true", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "My Session",
      isWindowHidden: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-001", "Bash"));

    expect(onPendingDecision).toHaveBeenCalledOnce();
    expect(onPendingDecision).toHaveBeenCalledWith("My Session", "Bash");
  });

  it("onPendingDecision callback is NOT called when isWindowHidden returns false", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "My Session",
      isWindowHidden: () => false,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-001", "Bash"));

    expect(onPendingDecision).not.toHaveBeenCalled();
  });
});

describe("RF-FIX-01 AC-1: dedup — same request id does not re-notify", () => {
  it("firing the same request id twice only calls onPendingDecision once", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Session A",
      isWindowHidden: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-dup", "Read"));
    [...evCh][0].fire(permRequestEvent("req-dup", "Read"));

    expect(onPendingDecision).toHaveBeenCalledOnce();
  });
});

describe("RF-FIX-01 AC-3: dedup reset on init — new bridge can re-notify", () => {
  it("after init clears pendingPermRequest, a new request with same id can notify again", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Session B",
      isWindowHidden: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;

    // First bridge fires a perm request — notification fires.
    [...evCh][0].fire(permRequestEvent("req-x", "Write"));
    expect(onPendingDecision).toHaveBeenCalledOnce();

    // Bridge respawns — init clears pendingPermRequest and the dedup set.
    [...evCh][0].fire(initEvent("new-bridge-session-id"));

    // New bridge fires same request id — should notify again (dedup cleared).
    [...evCh][0].fire(permRequestEvent("req-x", "Write"));
    expect(onPendingDecision).toHaveBeenCalledTimes(2);
  });
});

describe("RF-FIX-02: notification body includes session label", () => {
  it("onPendingDecision receives the session label set on the store", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Refactor PR",
      isWindowHidden: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-label-test", "Bash"));

    expect(onPendingDecision).toHaveBeenCalledWith("Refactor PR", "Bash");
  });
});

describe("RF-FIX-01 bypass guard: bypassPermissions sessions must NOT notify", () => {
  it("isBypassMode=true suppresses notification even when window is hidden", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Bypass Session",
      isWindowHidden: () => true,
      isBypassMode: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-bypass-001", "Bash"));

    expect(onPendingDecision).not.toHaveBeenCalled();
  });

  it("isBypassMode=true still stores pendingPermRequest (only notification is suppressed)", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    const store = new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Bypass Session",
      isWindowHidden: () => true,
      isBypassMode: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-bypass-002", "Write"));

    expect(onPendingDecision).not.toHaveBeenCalled();
    expect(store.getSnapshot().pendingPermRequest).not.toBeNull();
    expect(store.getSnapshot().pendingPermRequest?.id).toBe("req-bypass-002");
  });

  it("isBypassMode=false/undefined restores normal notification behavior", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Normal Session",
      isWindowHidden: () => true,
      isBypassMode: () => false,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-normal-001", "Read"));

    expect(onPendingDecision).toHaveBeenCalledOnce();
    expect(onPendingDecision).toHaveBeenCalledWith("Normal Session", "Read");
  });

  it("predicate is re-evaluated per request: flip bypass off → next request notifies", async () => {
    const onPendingDecision = vi.fn();
    const bus = makeStubBus();
    let bypassOn = true;
    new AgentSessionStore("s1", bus.listen, {
      onPendingDecision,
      sessionLabel: "Flipping Session",
      isWindowHidden: () => true,
      isBypassMode: () => bypassOn,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;

    // First request arrives while bypass is active — no notification.
    [...evCh][0].fire(permRequestEvent("req-flip-001", "Bash"));
    expect(onPendingDecision).not.toHaveBeenCalled();

    // Flip bypass off.
    bypassOn = false;

    // Second request (different id) arrives — should notify now.
    [...evCh][0].fire(permRequestEvent("req-flip-002", "Bash"));
    expect(onPendingDecision).toHaveBeenCalledOnce();
    expect(onPendingDecision).toHaveBeenCalledWith("Flipping Session", "Bash");
  });
});
