/**
 * Regression test: alert on pending agent decision (dedup, bypass suppression,
 * session label forwarding).
 *
 * Bug: when a `_entry_perm_request` arrives in AgentSessionStore the alert
 * could fire multiple times (re-render dedup missing), fire in bypass-mode
 * sessions (user has nothing to act on), or carry the wrong session label.
 *
 * Fix: AgentSessionStore deduplicates by request id (cleared on init),
 * suppresses when `isBypassMode()` returns true, and forwards `sessionLabel`
 * as the second arg to `alertFn` (defaulting to `alertInteractionNeeded`).
 * Tests inject `alertFn` as a vi.fn() stub to avoid DOM/audio dependencies.
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

describe("RF-FIX-01: alert is fired when perm-request arrives", () => {
  it("alertFn is called on perm-request", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "My Session",
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-001", "Bash"));

    expect(alertFn).toHaveBeenCalledOnce();
    expect(alertFn).toHaveBeenCalledWith("Bash", "My Session");
  });
});

describe("RF-FIX-01 AC-1: dedup — same request id does not re-alert", () => {
  it("firing the same request id twice only calls alertFn once", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Session A",
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-dup", "Read"));
    [...evCh][0].fire(permRequestEvent("req-dup", "Read"));

    expect(alertFn).toHaveBeenCalledOnce();
  });
});

describe("RF-FIX-01 AC-3: dedup reset on init — new bridge can re-alert", () => {
  it("after init clears dedup set, a new request with same id alerts again", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Session B",
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;

    // First bridge fires a perm request — alert fires.
    [...evCh][0].fire(permRequestEvent("req-x", "Write"));
    expect(alertFn).toHaveBeenCalledOnce();

    // Bridge respawns — init clears the dedup set.
    [...evCh][0].fire(initEvent("new-bridge-session-id"));

    // New bridge fires same request id — should alert again (dedup cleared).
    [...evCh][0].fire(permRequestEvent("req-x", "Write"));
    expect(alertFn).toHaveBeenCalledTimes(2);
  });
});

describe("RF-FIX-02: notification body includes session label", () => {
  it("alertFn receives the session label set on the store", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Refactor PR",
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-label-test", "Bash"));

    expect(alertFn).toHaveBeenCalledWith("Bash", "Refactor PR");
  });
});

describe("RF-FIX-01 bypass guard: bypassPermissions sessions must NOT alert", () => {
  it("isBypassMode=true suppresses alert", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Bypass Session",
      isBypassMode: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-bypass-001", "Bash"));

    expect(alertFn).not.toHaveBeenCalled();
  });

  it("isBypassMode=true still stores pendingPermRequest (only alert is suppressed)", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    const store = new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Bypass Session",
      isBypassMode: () => true,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-bypass-002", "Write"));

    expect(alertFn).not.toHaveBeenCalled();
    expect(store.getSnapshot().pendingPermRequest).not.toBeNull();
    expect(store.getSnapshot().pendingPermRequest?.id).toBe("req-bypass-002");
  });

  it("isBypassMode=false/undefined restores normal alert behavior", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Normal Session",
      isBypassMode: () => false,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;
    [...evCh][0].fire(permRequestEvent("req-normal-001", "Read"));

    expect(alertFn).toHaveBeenCalledOnce();
    expect(alertFn).toHaveBeenCalledWith("Read", "Normal Session");
  });

  it("predicate is re-evaluated per request: flip bypass off → next request alerts", async () => {
    const alertFn = vi.fn();
    const bus = makeStubBus();
    let bypassOn = true;
    new AgentSessionStore("s1", bus.listen, {
      alertFn,
      sessionLabel: "Flipping Session",
      isBypassMode: () => bypassOn,
    });
    await Promise.resolve();

    const evCh = bus.channels.get("agent-event-s1")!;

    // First request arrives while bypass is active — no alert.
    [...evCh][0].fire(permRequestEvent("req-flip-001", "Bash"));
    expect(alertFn).not.toHaveBeenCalled();

    // Flip bypass off.
    bypassOn = false;

    // Second request (different id) arrives — should alert now.
    [...evCh][0].fire(permRequestEvent("req-flip-002", "Bash"));
    expect(alertFn).toHaveBeenCalledOnce();
    expect(alertFn).toHaveBeenCalledWith("Bash", "Flipping Session");
  });
});
