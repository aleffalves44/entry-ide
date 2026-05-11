/**
 * Tests for `deriveActivity` — the helper the session header calls to decide
 * what status to show:  thinking / running / awaiting / idle.  Pure function
 * over the reducer state, so we hand-build minimal states rather than running
 * the full reducer here.
 */
import { describe, it, expect } from "vitest";
import { deriveActivity, emptyState } from "../agent/messageStore";
import type { AgentSessionState, RenderedMessage } from "../agent/messageStore";
import type {
  TextBlockData,
  ToolUseBlockData,
} from "../agent/types";

const text = (s: string): TextBlockData => ({ type: "text", text: s });
const toolUse = (id: string, name: string): ToolUseBlockData => ({
  type: "tool_use",
  id,
  name,
  input: {},
});

const userMessage = (id: string, ts: number): RenderedMessage => ({
  id,
  role: "user",
  blocks: [text("hello")],
  timestamp: ts,
});

const assistantMessage = (
  id: string,
  ts: number,
  blocks: RenderedMessage["blocks"] = [text("ok")],
): RenderedMessage => ({
  id,
  role: "assistant",
  blocks,
  timestamp: ts,
});

const stateWith = (overrides: Partial<AgentSessionState>): AgentSessionState => ({
  ...emptyState(),
  ...overrides,
});

describe("deriveActivity", () => {
  it("returns idle when there are no messages", () => {
    expect(deriveActivity(emptyState())).toEqual({ status: "idle", since: null });
  });

  it("returns idle when the last message is an assistant reply with no in-flight work", () => {
    const state = stateWith({
      messages: [userMessage("u1", 100), assistantMessage("a1", 200)],
    });
    expect(deriveActivity(state)).toEqual({ status: "idle", since: null });
  });

  it("reports awaiting when the user has sent a message and no assistant reply has come back", () => {
    const state = stateWith({
      messages: [userMessage("u1", 100)],
    });
    expect(deriveActivity(state)).toEqual({ status: "awaiting", since: 100 });
  });

  it("reports thinking while the assistant message is mid-stream", () => {
    const a = assistantMessage("a1", 250);
    const state = stateWith({
      messages: [userMessage("u1", 100), a],
      streamingMessageId: "a1",
    });
    expect(deriveActivity(state)).toEqual({ status: "thinking", since: 250 });
  });

  it("reports running when a tool is in flight, and surfaces the tool name", () => {
    const a = assistantMessage("a1", 300, [
      text("running a command"),
      toolUse("tool-1", "Bash"),
    ]);
    const state = stateWith({
      messages: [userMessage("u1", 100), a],
      streamingMessageId: "a1",
      runningToolUseIds: new Set(["tool-1"]),
    });
    const activity = deriveActivity(state);
    expect(activity.status).toBe("running");
    expect(activity.toolName).toBe("Bash");
    expect(activity.since).toBe(300);
  });

  it("surfaces the most recently-issued tool when multiple are running", () => {
    const a = assistantMessage("a1", 300, [
      toolUse("tool-1", "Bash"),
      text("..."),
      toolUse("tool-2", "Grep"),
    ]);
    const state = stateWith({
      messages: [a],
      runningToolUseIds: new Set(["tool-1", "tool-2"]),
    });
    expect(deriveActivity(state).toolName).toBe("Grep");
  });

  it("falls back to running with no toolName when the running id can't be matched", () => {
    const state = stateWith({
      messages: [assistantMessage("a1", 300)],
      runningToolUseIds: new Set(["unmatched-id"]),
    });
    expect(deriveActivity(state)).toEqual({
      status: "running",
      toolName: undefined,
      since: null,
    });
  });

  it("prefers running over thinking when both are true (tool calls dominate the visible status)", () => {
    const a = assistantMessage("a1", 200, [toolUse("t1", "WebFetch")]);
    const state = stateWith({
      messages: [a],
      streamingMessageId: "a1",
      runningToolUseIds: new Set(["t1"]),
    });
    expect(deriveActivity(state).status).toBe("running");
  });

  // ── Regression: stuck-on-awaiting after user interrupt ─────────────
  //
  // When the user clicks the Stop button BEFORE Claude has streamed
  // its first byte, the bridge sends an interrupt to the SDK and the
  // SDK emits a closing `result` event.  The reducer clears
  // `streamingMessageId` but does NOT append an assistant message
  // (none ever arrived), so the message list is still `[user_msg]`
  // and the old `deriveActivity` returned `awaiting` forever — the
  // "awaiting claude" indicator spun even though the turn was over
  // and "[Request interrupted by user]" was visible in the footer.
  //
  // Fix: track `resultEventAt` and short-circuit step 3 when a
  // result event is dated at or after the trailing user message.

  it("returns idle when a result event arrives after a user message with no assistant reply (Stop pre-stream)", () => {
    const state = stateWith({
      messages: [userMessage("u1", 100)],
      // The reducer would normally also have set resultEvent here;
      // for deriveActivity what matters is the timestamp marker.
      resultEventAt: 150,
    });
    expect(deriveActivity(state)).toEqual({ status: "idle", since: null });
  });

  it("still reports awaiting for a NEW user message sent after a previously-finished turn", () => {
    // The user sent u1, got a reply, then sent u2.  The
    // resultEventAt from turn 1 is older than u2 — we must NOT
    // short-circuit to idle just because some past result exists.
    const state = stateWith({
      messages: [
        userMessage("u1", 100),
        assistantMessage("a1", 150),
        userMessage("u2", 300),
      ],
      resultEventAt: 200, // closed turn 1, before u2
    });
    expect(deriveActivity(state)).toEqual({ status: "awaiting", since: 300 });
  });

  it("interrupt with no preceding result event still reports awaiting (defensive)", () => {
    // Belt-and-suspenders: if the bridge crashes mid-interrupt and
    // never emits a result event, we don't accidentally flip to idle.
    const state = stateWith({
      messages: [userMessage("u1", 100)],
      resultEventAt: null,
    });
    expect(deriveActivity(state)).toEqual({ status: "awaiting", since: 100 });
  });
});
