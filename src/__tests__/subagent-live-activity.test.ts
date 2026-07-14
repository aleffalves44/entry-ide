/**
 * selectSubagentLiveActivity (flow visibility) — what a running
 * subagent is doing right now, derived purely from state.messages.
 */
import { describe, it, expect } from "vitest";
import { selectSubagentLiveActivity } from "../agent/subagentSelectors";
import { emptyState, type AgentSessionState, type RenderedMessage } from "../agent/messageStore";

const TASK_ID = "toolu_task_1";

function msg(partial: Partial<RenderedMessage>): RenderedMessage {
  return {
    id: "m1",
    role: "assistant",
    blocks: [],
    parentToolUseId: null,
    timestamp: 1_000,
    ...partial,
  } as RenderedMessage;
}

function stateWith(messages: RenderedMessage[]): AgentSessionState {
  return { ...emptyState(), messages };
}

describe("selectSubagentLiveActivity", () => {
  it("null while no subagent message has landed (spawn gap)", () => {
    const state = stateWith([
      msg({
        id: "root",
        blocks: [
          { type: "tool_use", id: TASK_ID, name: "Task", input: { description: "Build auth" } },
        ] as never,
      }),
    ]);
    expect(selectSubagentLiveActivity(state, TASK_ID)).toBeNull();
  });

  it("surfaces last tool call, narration, step count and start time", () => {
    const state = stateWith([
      msg({
        id: "root",
        blocks: [
          { type: "tool_use", id: TASK_ID, name: "Task", input: { description: "Build auth" } },
        ] as never,
      }),
      msg({
        id: "sub1",
        parentToolUseId: TASK_ID,
        timestamp: 2_000,
        blocks: [{ type: "text", text: "vou começar pelos testes\ncorrigindo o mock do client" }] as never,
      }),
      msg({
        id: "sub1",
        parentToolUseId: TASK_ID,
        timestamp: 3_000,
        blocks: [
          { type: "tool_use", id: "t2", name: "Bash", input: { command: "npm test" } },
        ] as never,
      }),
    ]);

    const activity = selectSubagentLiveActivity(state, TASK_ID)!;
    expect(activity).not.toBeNull();
    expect(activity.name).toContain("Build auth");
    expect(activity.since).toBe(2_000);
    expect(activity.lastAction).toBe("Bash: npm test");
    expect(activity.lastNarration).toBe("corrigindo o mock do client");
    expect(activity.messageCount).toBe(2);
  });

  it("truncates long tool targets", () => {
    const long = "x".repeat(120);
    const state = stateWith([
      msg({
        id: "sub1",
        parentToolUseId: TASK_ID,
        timestamp: 2_000,
        blocks: [
          { type: "tool_use", id: "t2", name: "Bash", input: { command: long } },
        ] as never,
      }),
    ]);
    const activity = selectSubagentLiveActivity(state, TASK_ID)!;
    expect(activity.lastAction!.length).toBeLessThanOrEqual("Bash: ".length + 64);
    expect(activity.lastAction!.endsWith("…")).toBe(true);
  });
});
