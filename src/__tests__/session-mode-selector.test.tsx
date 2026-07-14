/**
 * session-mode-selector.test.tsx
 *
 * Covers SPEC R1–R4, R6, R7:
 *   - Renders exactly 3 options (Agent / Terminal / SSH).
 *   - Active mode carries aria-checked="true" (all others are "false").
 *   - Disabled states: SSH always disabled; Agent disabled when provider != claude.
 *   - role="radiogroup" / role="radio" semantics.
 *   - Active mode description rendered.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  SessionModeSelector,
  resolveDisplayMode,
  type SelectorMode,
} from "../components/SessionModeSelector";
import type { SessionData } from "../types/session";

// ─── Minimal SessionData factory ─────────────────────────────────────
function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: "test-session",
    label: "Test",
    description: "",
    color: "",
    group: null,
    phase: "idle",
    working_directory: "/",
    shell: "bash",
    created_at: "",
    last_activity_at: "",
    workspace_paths: [],
    detected_agent: null,
    metrics: { available_actions: [], recent_actions: [] } as unknown as SessionData["metrics"],
    ai_provider: "claude",
    auto_approve: false,
    permission_mode: "default",
    custom_prefix: "",
    custom_suffix: "",
    channels: [],
    context_injected: false,
    ssh_info: null,
    mode: "agent",
    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────
function render(session: SessionData) {
  return renderToString(
    <SessionModeSelector session={session} onRequestConvert={() => {}} />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("SessionModeSelector — rendering", () => {
  it("renders exactly 3 radio options", () => {
    const html = render(makeSession());
    const matches = html.match(/role="radio"/g);
    expect(matches?.length).toBe(3);
  });

  it("renders Agent, Terminal, SSH labels", () => {
    const html = render(makeSession());
    expect(html).toContain("Agent");
    expect(html).toContain("Terminal");
    expect(html).toContain("SSH");
  });

  it("wraps options in a radiogroup", () => {
    const html = render(makeSession());
    expect(html).toContain('role="radiogroup"');
  });
});

describe("SessionModeSelector — active mode (aria-checked)", () => {
  it("agent mode: Agent is aria-checked=true, others false", () => {
    const html = render(makeSession({ mode: "agent", ssh_info: null }));
    // Agent button must be checked
    expect(html).toMatch(/aria-checked="true"[^>]*>[\s\S]*?Agent/);
    // Terminal and SSH must NOT be checked
    const checkedTrue = (html.match(/aria-checked="true"/g) ?? []).length;
    expect(checkedTrue).toBe(1);
    const checkedFalse = (html.match(/aria-checked="false"/g) ?? []).length;
    expect(checkedFalse).toBe(2);
  });

  it("terminal mode: Terminal is aria-checked=true", () => {
    const html = render(makeSession({ mode: "terminal", ssh_info: null }));
    expect(html).toMatch(/aria-checked="true"[^>]*>[\s\S]*?Terminal/);
  });

  it("ssh session: SSH is aria-checked=true", () => {
    const session = makeSession({
      mode: "terminal",
      ssh_info: { host: "example.com", port: 22, user: "root", tmux_session: null, identity_file: null, port_forwards: [] },
    });
    const html = render(session);
    expect(html).toMatch(/aria-checked="true"[^>]*>[\s\S]*?SSH/);
  });
});

describe("SessionModeSelector — disabled states (R3/R4)", () => {
  it("SSH option is always aria-disabled", () => {
    const html = render(makeSession({ mode: "agent" }));
    // The SSH button must carry aria-disabled
    // (We check the is-disabled class as aria-disabled may be omitted or set to "true")
    expect(html).toContain("is-disabled");
    // Tooltip text for SSH
    expect(html).toContain("Available for new sessions");
  });

  it("Agent option is disabled when provider is not claude", () => {
    const session = makeSession({ ai_provider: "gemini", mode: "terminal" });
    const html = render(session);
    // At least two options are disabled (agent + ssh)
    const disabledCount = (html.match(/is-disabled/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(2);
    // Agent tooltip mentions provider
    expect(html).toContain("gemini");
  });

  it("Agent option is enabled when provider is claude", () => {
    const session = makeSession({ ai_provider: "claude", mode: "terminal" });
    const html = render(session);
    // Only SSH should be disabled (1 occurrence of is-disabled for SSH)
    // Agent should not carry is-disabled in its own button element
    // We can't trivially assert this per-button in SSR; assert tooltip absence.
    expect(html).not.toContain("requires Claude");
  });
});

describe("SessionModeSelector — description (R2)", () => {
  it("shows agent description when mode is agent", () => {
    const html = render(makeSession({ mode: "agent" }));
    expect(html).toContain("AI conversation with tools, diffs and approvals.");
  });

  it("shows terminal description when mode is terminal (non-ssh)", () => {
    const html = render(makeSession({ mode: "terminal", ssh_info: null }));
    expect(html).toContain("Classic shell — full PTY, any command.");
  });

  it("shows ssh description when session has ssh_info", () => {
    const session = makeSession({
      mode: "terminal",
      ssh_info: { host: "example.com", port: 22, user: "root", tmux_session: null, identity_file: null, port_forwards: [] },
    });
    const html = render(session);
    expect(html).toContain("Remote shell on another machine.");
  });
});

describe("resolveDisplayMode helper", () => {
  it("returns 'agent' for agent-mode sessions without ssh_info", () => {
    expect(resolveDisplayMode(makeSession({ mode: "agent", ssh_info: null }))).toBe("agent");
  });

  it("returns 'terminal' for terminal-mode sessions without ssh_info", () => {
    expect(resolveDisplayMode(makeSession({ mode: "terminal", ssh_info: null }))).toBe("terminal");
  });

  it("returns 'ssh' for sessions with ssh_info regardless of mode", () => {
    const session = makeSession({
      mode: "terminal",
      ssh_info: { host: "h", port: 22, user: "u", tmux_session: null, identity_file: null, port_forwards: [] },
    });
    expect(resolveDisplayMode(session)).toBe("ssh");
  });
});
