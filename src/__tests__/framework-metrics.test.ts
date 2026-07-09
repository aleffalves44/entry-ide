/**
 * Framework metrics derivation — pure-function tests.
 *
 * Covers command/phase attribution and turn-row derivation including the
 * per-model and per-subagent breakdowns and their dedup-key namespacing.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  commandFromUserText,
  phaseFromCommand,
  deriveTurnRows,
  _resetFrameworkMetricsForTest,
} from "../agent/frameworkMetrics";
import { emptyState } from "../agent/messageStore";
import type { AgentSessionState, RenderedMessage } from "../agent/messageStore";
import type { InitEvent, ResultEvent } from "../agent/types";

/* ─── fixtures ─────────────────────────────────────────────────────── */

const INIT: InitEvent = {
  type: "system",
  subtype: "init",
  cwd: "/repo",
  session_id: "sess1",
  uuid: "init-1",
  tools: [],
  slash_commands: [],
  mcp_servers: [],
  model: "claude-sonnet-5",
  permissionMode: "default",
} as unknown as InitEvent;

function userMsg(text: string, ts: number): RenderedMessage {
  return {
    id: `user-${ts}`,
    role: "user",
    blocks: [{ type: "text", text }],
    timestamp: ts,
  } as RenderedMessage;
}

function assistantMsg(
  id: string,
  ts: number,
  opts: {
    blocks?: RenderedMessage["blocks"];
    parentToolUseId?: string;
    usage?: { output_tokens?: number; input_tokens?: number };
  } = {},
): RenderedMessage {
  return {
    id,
    role: "assistant",
    blocks: opts.blocks ?? [{ type: "text", text: "ok" }],
    parentToolUseId: opts.parentToolUseId ?? null,
    usage: opts.usage,
    timestamp: ts,
  } as RenderedMessage;
}

const RESULT: ResultEvent = {
  type: "result",
  subtype: "success",
  is_error: false,
  uuid: "turn-1",
  duration_ms: 45_000,
  total_cost_usd: 0.31,
  usage: {
    input_tokens: 1200,
    output_tokens: 800,
    cache_read_input_tokens: 90_000,
    cache_creation_input_tokens: 500,
  },
};

function baseState(messages: RenderedMessage[]): AgentSessionState {
  const s = emptyState();
  return {
    ...s,
    initialized: true,
    initEvent: INIT,
    messages,
    resultEvent: RESULT,
  };
}

beforeEach(() => {
  _resetFrameworkMetricsForTest();
});

/* ─── command / phase attribution ──────────────────────────────────── */

describe("commandFromUserText", () => {
  it("extracts a plugin-qualified command and drops the args", () => {
    expect(commandFromUserText("/harness-cmd:task CRED-1234 fix bug")).toBe(
      "harness-cmd:task",
    );
  });

  it("returns null for prose", () => {
    expect(commandFromUserText("please fix the bug")).toBeNull();
  });

  it("returns null for a bare slash", () => {
    expect(commandFromUserText("/")).toBeNull();
  });

  it("handles leading whitespace", () => {
    expect(commandFromUserText("  /plan thing")).toBe("plan");
  });
});

describe("phaseFromCommand", () => {
  it("maps plugin-qualified commands to their SDD phase", () => {
    expect(phaseFromCommand("harness-cmd:spike")).toBe("spike");
    expect(phaseFromCommand("harness-cmd:plan")).toBe("plan");
    expect(phaseFromCommand("harness-cmd:task")).toBe("task");
    expect(phaseFromCommand("harness-cmd:pr")).toBe("pr");
  });

  it("maps bare commands too", () => {
    expect(phaseFromCommand("plan")).toBe("plan");
  });

  it("returns null for non-phase commands and null input", () => {
    expect(phaseFromCommand("harness-cmd:ai-context")).toBeNull();
    expect(phaseFromCommand("compact")).toBeNull();
    expect(phaseFromCommand(null)).toBeNull();
  });
});

/* ─── deriveTurnRows ───────────────────────────────────────────────── */

describe("deriveTurnRows", () => {
  it("produces an authoritative turn row from the result event", () => {
    const state = baseState([
      userMsg("/harness-cmd:task CRED-1", 100),
      assistantMsg("a1", 110),
    ]);
    const rows = deriveTurnRows("sess1", state, RESULT);

    const turn = rows.find((r) => r.kind === "turn");
    expect(turn).toBeDefined();
    expect(turn).toMatchObject({
      session_id: "sess1",
      turn_uuid: "turn-1",
      agent: "main",
      model: "claude-sonnet-5",
      command: "harness-cmd:task",
      phase: "task",
      input_tokens: 1200,
      output_tokens: 800,
      cache_read_tokens: 90_000,
      cache_creation_tokens: 500,
      duration_ms: 45_000,
      cost_usd: 0.31,
    });
  });

  it("records prose turns with null command/phase", () => {
    const state = baseState([userMsg("fix the bug", 100), assistantMsg("a1", 110)]);
    const rows = deriveTurnRows("sess1", state, RESULT);
    const turn = rows.find((r) => r.kind === "turn")!;
    expect(turn.command).toBeNull();
    expect(turn.phase).toBeNull();
  });

  it("emits model rows only when more than one model ran", () => {
    const single = deriveTurnRows(
      "sess1",
      baseState([userMsg("/plan x", 100)]),
      { ...RESULT, modelUsage: { "claude-sonnet-5": { inputTokens: 10 } } },
    );
    expect(single.filter((r) => r.kind === "model")).toHaveLength(0);

    const multi = deriveTurnRows(
      "sess1",
      baseState([userMsg("/plan x", 100)]),
      {
        ...RESULT,
        modelUsage: {
          "claude-sonnet-5": { inputTokens: 10, outputTokens: 20, costUSD: 0.1 },
          "claude-haiku-4-5": { inputTokens: 5, outputTokens: 8, costUSD: 0.01 },
        },
      },
    );
    const modelRows = multi.filter((r) => r.kind === "model");
    expect(modelRows).toHaveLength(2);
    const haiku = modelRows.find((r) => r.model === "claude-haiku-4-5")!;
    expect(haiku.input_tokens).toBe(5);
    expect(haiku.output_tokens).toBe(8);
    expect(haiku.cost_usd).toBe(0.01);
    // Dedup keys are namespaced per model — never collide with the turn row.
    expect(new Set(multi.map((r) => `${r.turn_uuid}|${r.agent}`)).size).toBe(multi.length);
  });

  it("emits agent rows for subagents dispatched this turn, summing output tokens", () => {
    const taskBlock = {
      type: "tool_use" as const,
      id: "tu1",
      name: "Task",
      input: { subagent_type: "Build", description: "Build the feature" },
    };
    const state = baseState([
      userMsg("/harness-cmd:task go", 100),
      assistantMsg("a1", 110, { blocks: [taskBlock] }),
      // The reducer merges stream events per message id, so the state holds
      // ONE message per subagent API call with its final usage.
      assistantMsg("sub1", 120, {
        parentToolUseId: "tu1",
        usage: { output_tokens: 500, input_tokens: 90_000 },
      }),
      assistantMsg("sub2", 125, {
        parentToolUseId: "tu1",
        usage: { output_tokens: 700, input_tokens: 95_000 },
      }),
    ]);
    const rows = deriveTurnRows("sess1", state, RESULT);

    const agentRows = rows.filter((r) => r.kind === "agent");
    expect(agentRows.length).toBeGreaterThanOrEqual(1);
    expect(agentRows[0].agent).toBe("Build");
    // Sum of final output tokens across the thread's messages.
    const totalOutput = agentRows.reduce((n, r) => n + r.output_tokens, 0);
    expect(totalOutput).toBe(1200);
    // Input is intentionally 0 — per-call inputs are not additive.
    expect(agentRows[0].input_tokens).toBe(0);
    expect(agentRows[0].turn_uuid).toContain("turn-1:agent:tu1");
  });

  it("prefers the authoritative <usage> block from the Task tool_result", () => {
    const taskBlock = {
      type: "tool_use" as const,
      id: "tu9",
      name: "Task",
      input: { subagent_type: "Build" },
    };
    const state = baseState([
      userMsg("/harness-cmd:task go", 100),
      assistantMsg("a1", 110, { blocks: [taskBlock] }),
      // Stream message with tiny partial usage — must be IGNORED in favor
      // of the tool_result's <usage> totals.
      assistantMsg("sub1", 120, { parentToolUseId: "tu9", usage: { output_tokens: 63 } }),
    ]);
    state.toolResults.set("tu9", {
      type: "tool_result",
      tool_use_id: "tu9",
      content:
        "All done.\n<usage>\ntotal_tokens: 48213\ntool_uses: 17\nduration_ms: 92500\n</usage>",
      is_error: false,
    } as never);

    const rows = deriveTurnRows("sess1", state, RESULT);
    const agentRow = rows.find((r) => r.kind === "agent")!;
    expect(agentRow.output_tokens).toBe(48213);
    expect(agentRow.duration_ms).toBe(92500);
    expect(agentRow.agent).toBe("Build");
  });

  it("does not re-emit agent rows for Task blocks from previous turns", () => {
    const oldTask = {
      type: "tool_use" as const,
      id: "tu-old",
      name: "Task",
      input: { subagent_type: "Explore" },
    };
    const state = baseState([
      userMsg("/plan first", 50),
      assistantMsg("a0", 60, { blocks: [oldTask] }),
      assistantMsg("sub-old", 70, { parentToolUseId: "tu-old", usage: { output_tokens: 100 } }),
      userMsg("/harness-cmd:task second", 100),
      assistantMsg("a1", 110),
    ]);
    const rows = deriveTurnRows("sess1", state, RESULT);
    expect(rows.filter((r) => r.kind === "agent")).toHaveLength(0);
  });
});
